"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  FileTextIcon,
  KeyIcon,
  PlayCircleIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  type ApiKeyItem,
  type CreatedApiKey,
  type McpStatusResponse,
  type VerifyMcpResponse,
  createApiKey,
  getMcpStatus,
  listApiKeys,
  revokeApiKey,
  verifyMcpConnection,
} from "@/lib/api/api-keys";
import { useAuthStore } from "@/stores/auth-store";

interface ToolItem {
  name: string;
  description: string;
  category: string;
  examplePrompt: string;
  params?: string;
}

const DEFAULT_TOOLS: ToolItem[] = [
  {
    name: "kinetix_get_workspace_structure",
    description: "Inspect spaces, folders, and lists hierarchy",
    category: "Workspace",
    examplePrompt: "Show me all spaces and lists in my Kinetix workspace.",
    params: "workspace_id?: string",
  },
  {
    name: "kinetix_list_tasks",
    description: "Query and filter workspace tasks by date, status, or keyword",
    category: "Tasks",
    examplePrompt: "List all high-priority tasks due today in Kinetix.",
    params: "list_id?: string, filter?: 'today' | 'overdue' | 'assigned', search?: string",
  },
  {
    name: "kinetix_get_task",
    description: "Get complete task details, subtasks, checklists & comments",
    category: "Tasks",
    examplePrompt: "Show me details and recent comments for task 8f4...",
    params: "task_id: string",
  },
  {
    name: "kinetix_create_task",
    description: "Create tasks in specified lists with due dates & priorities",
    category: "Tasks",
    examplePrompt: "Create a task 'Audit database indexes' in the Sprint list with urgent priority.",
    params: "title: string, list_id: string, priority?: 'urgent'|'high'|'normal'|'low', due_date?: string",
  },
  {
    name: "kinetix_update_task",
    description: "Update task title, status, priority, or assignees",
    category: "Tasks",
    examplePrompt: "Mark task 'Fix mobile navbar' as DONE in Kinetix.",
    params: "task_id: string, status?: 'OPEN'|'TODO'|'IN_PROGRESS'|'DONE', priority?: string",
  },
  {
    name: "kinetix_delete_task",
    description: "Permanently delete a task and subtasks from the workspace",
    category: "Tasks",
    examplePrompt: "Delete task 'Old duplicate item' from Kinetix.",
    params: "task_id: string",
  },
  {
    name: "kinetix_create_subtask",
    description: "Create nested subtasks under a parent task",
    category: "Tasks",
    examplePrompt: "Add a subtask 'Run migration dry-run' under task 'Deploy v2.1'.",
    params: "parent_task_id: string, title: string",
  },
  {
    name: "kinetix_add_task_comment",
    description: "Post notes, status updates, or blockers directly on tasks",
    category: "Tasks",
    examplePrompt: "Add a comment to task 123 saying 'All tests passed on staging'.",
    params: "task_id: string, content: string",
  },
  {
    name: "kinetix_delete_task_comment",
    description: "Delete a specific comment from a task",
    category: "Tasks",
    examplePrompt: "Remove outdated comment on task 123.",
    params: "task_id: string, comment_id: string",
  },
  {
    name: "kinetix_list_channels",
    description: "List accessible chat channels in the workspace",
    category: "Chat",
    examplePrompt: "What chat channels do I have access to in Kinetix?",
    params: "workspace_id?: string",
  },
  {
    name: "kinetix_get_channel_messages",
    description: "Read recent messages and announcements in a channel",
    category: "Chat",
    examplePrompt: "What are the latest 10 messages in the #engineering channel?",
    params: "channel_id: string, limit?: number",
  },
  {
    name: "kinetix_post_channel_message",
    description: "Post updates to a channel by name or ID",
    category: "Chat",
    examplePrompt: "Post an update in #general: 'Sprint 14 review starts at 3 PM.'",
    params: "content: string, channel_name?: string, channel_id?: string",
  },
  {
    name: "kinetix_send_direct_message",
    description: "Send private direct messages to team members",
    category: "Chat",
    examplePrompt: "Send a DM to sarah@example.com: 'Can you review the PR?'",
    params: "content: string, recipient_email_or_id?: string, conversation_id?: string",
  },
  {
    name: "kinetix_list_direct_conversations",
    description: "List active personal direct message threads",
    category: "Chat",
    examplePrompt: "Show my recent direct message conversations in Kinetix.",
    params: "workspace_id?: string",
  },
  {
    name: "kinetix_get_direct_messages",
    description: "Read recent messages in a direct conversation",
    category: "Chat",
    examplePrompt: "Read the last messages from my conversation with Alex.",
    params: "conversation_id: string, limit?: number",
  },
  {
    name: "kinetix_create_personal_post",
    description: "Publish an update to workspace home feed",
    category: "Feed",
    examplePrompt: "Publish a post to the workspace feed: 'Excited to announce our new launch!'",
    params: "content: string, channel?: string",
  },
  {
    name: "kinetix_search",
    description: "Cross-entity vector RAG search across tasks, chat, and docs",
    category: "Search",
    examplePrompt: "Search Kinetix across docs, tasks, and messages for 'SOC2 compliance audit'.",
    params: "query: string, scope?: 'all' | 'tasks' | 'messages' | 'docs'",
  },
];

const STARTER_PROMPTS = [
  {
    title: "📋 Executive Standup",
    subtitle: "Built-in Standup Workflow",
    prompt: "Generate an executive daily standup report for my active Kinetix workspace summarizing today's priority tasks, recent completions, and blockers.",
  },
  {
    title: "⚡ Feature Specification Breakdown",
    subtitle: "Technical Architecture Breakdown",
    prompt: "Break down the task 'User Authentication & MFA' into 4 prioritized subtasks with clear acceptance criteria.",
  },
  {
    title: "🔍 Cross-Entity Knowledge Search",
    subtitle: "RAG Docs & Discussions Search",
    prompt: "Search Kinetix across all documentation, task tickets, and chat discussions for 'API rate limits' and give me a synthesized summary.",
  },
  {
    title: "💬 Team Announcement Broadcast",
    subtitle: "Chat Channel Integration",
    prompt: "Post a message to #general channel: '🚀 Kinetix MCP server integration is live and connected.'",
  },
];

export function McpSettingsCard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const workspaces = useAuthStore((s) => s.workspaces);
  const activeWorkspaceId = useAuthStore((s) => s.activeWorkspaceId);

  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverMeta, setServerMeta] = useState<McpStatusResponse | null>(null);

  // New key dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("My AI Assistant");
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>("all");
  const [expiryDays, setExpiryDays] = useState<string>("90");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null);

  // Diagnostics modal
  const [isDiagOpen, setIsDiagOpen] = useState(false);
  const [diagToken, setDiagToken] = useState("");
  const [diagResult, setDiagResult] = useState<VerifyMcpResponse | null>(null);
  const [testingDiag, setTestingDiag] = useState(false);

  // Active guide tab & OS switcher
  const [activeTab, setActiveTab] = useState<"claude" | "claude-code" | "cursor" | "windsurf" | "sse">("claude");
  const [clientOs, setClientOs] = useState<"windows" | "mac" | "linux">("windows");

  // Selected tool detail dialog
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null);

  // Copy helpers
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Tool search & filter
  const [toolSearch, setToolSearch] = useState("");
  const [toolCategory, setToolCategory] = useState<string>("all");

  const fetchKeys = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const data = await listApiKeys(accessToken);
      setKeys(data);
    } catch {
      toast.error("Failed to load active API keys");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const meta = await getMcpStatus();
      setServerMeta(meta);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchStatus();
  }, [accessToken]);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreate = async () => {
    if (!accessToken) return;
    if (!keyName.trim()) {
      toast.error("Please enter a name for the token");
      return;
    }
    setCreating(true);
    try {
      const exp = expiryDays === "never" ? null : parseInt(expiryDays, 10);
      const wsId = targetWorkspaceId === "all" ? null : targetWorkspaceId;
      const res = await createApiKey(
        {
          name: keyName.trim(),
          workspaceId: wsId,
          expiresDays: exp,
        },
        accessToken
      );
      setCreatedKey(res);
      toast.success("New Personal Access Token generated!");
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!accessToken) return;
    if (!confirm("Are you sure you want to revoke this token? Any AI client using it will lose access immediately.")) return;
    try {
      await revokeApiKey(keyId, accessToken);
      toast.success("Token revoked successfully");
      fetchKeys();
    } catch {
      toast.error("Failed to revoke token");
    }
  };

  const runDiagnostics = async (tokenToTest?: string) => {
    const testToken = tokenToTest || diagToken || createdKey?.token || (keys.length > 0 ? keys[0].keyPrefix : "");
    if (!testToken || testToken.includes("...")) {
      toast.error("Please provide or generate a full Personal Access Token to test.");
      return;
    }
    setTestingDiag(true);
    setDiagResult(null);
    try {
      const res = await verifyMcpConnection({ token: testToken }, accessToken || undefined);
      setDiagResult(res);
      if (res.valid) {
        toast.success("Connection test passed!");
      } else {
        toast.error(res.message || "Connection verification failed");
      }
    } catch (err) {
      setDiagResult({
        valid: false,
        message: err instanceof Error ? err.message : "Diagnostics request failed",
      });
      toast.error("Diagnostics check failed");
    } finally {
      setTestingDiag(false);
    }
  };

  // Best token to display in configs
  const tokenToDisplay = createdKey?.token || (keys.length > 0 ? keys[0].keyPrefix : "knx_pat_YOUR_TOKEN_HERE");
  const backendDir = serverMeta?.backendDirectory || "C:\\Users\\hamza\\Desktop\\kinetix\\backend-py";

  const stdioJsonConfig = JSON.stringify(
    {
      mcpServers: {
        kinetix: {
          command: "uv",
          args: ["--directory", backendDir, "run", "python", "-m", "app.mcp.server"],
          env: {
            KINETIX_API_KEY: tokenToDisplay,
          },
        },
      },
    },
    null,
    2
  );

  const claudeCodeCommand = `claude mcp add kinetix uv -- --directory "${backendDir}" run python -m app.mcp.server -e KINETIX_API_KEY="${tokenToDisplay}"`;

  const sseUrl = typeof window !== "undefined"
    ? `${window.location.origin}/mcp/sse`
    : "http://localhost:4001/mcp/sse";

  const toolsList: ToolItem[] = DEFAULT_TOOLS;

  const filteredTools = toolsList.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(toolSearch.toLowerCase());
    const matchesCat = toolCategory === "all" || t.category.toLowerCase() === toolCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Overview & Live Status Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
              <BotIcon className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Model Context Protocol (MCP) & AI Integrations
                </h2>
                <Badge variant="outline" className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Production Ready (17 Tools)
                </Badge>
                <Badge variant="secondary" className="text-[11px] font-mono">
                  v2024-11-05
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your AI assistant (Claude Desktop, Cursor, Windsurf, Claude Code CLI, or custom agents) to your Kinetix workspace.
                Inspect tasks, manage workflows, search company knowledge, and collaborate seamlessly.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                setDiagToken(createdKey?.token || "");
                setDiagResult(null);
                setIsDiagOpen(true);
              }}
            >
              <PlayCircleIcon className="size-4 text-primary" />
              Diagnostics
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setCreatedKey(null);
                setKeyName("My AI Assistant");
                setTargetWorkspaceId(activeWorkspaceId || "all");
                setExpiryDays("90");
                setIsCreateOpen(true);
              }}
            >
              <PlusIcon className="size-4" />
              Generate Token
            </Button>
          </div>
        </div>
      </div>

      {/* Non-Technical Step-by-Step Setup Wizard */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Client Setup Wizard</h3>
            <p className="text-xs text-muted-foreground">Select your tool below for verified 1-click configuration instructions.</p>
          </div>
          <div className="flex flex-wrap items-center rounded-lg border border-border bg-muted p-1 gap-1">
            <button
              onClick={() => setActiveTab("claude")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "claude" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Claude Desktop
            </button>
            <button
              onClick={() => setActiveTab("claude-code")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "claude-code" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Claude Code CLI
            </button>
            <button
              onClick={() => setActiveTab("cursor")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "cursor" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cursor
            </button>
            <button
              onClick={() => setActiveTab("windsurf")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "windsurf" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Windsurf
            </button>
            <button
              onClick={() => setActiveTab("sse")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === "sse" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Remote / SSE
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {/* Claude Desktop Guide */}
          {activeTab === "claude" && (
            <div className="space-y-4">
              {/* 3 Step Visual Guide */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    1
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">Copy Configuration</p>
                    <p className="mt-0.5 text-muted-foreground">Click the "Copy Configuration" button below to copy your tailored JSON.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    2
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">Open Config File</p>
                    <p className="mt-0.5 text-muted-foreground">Use the 1-click open command below to open your Claude config file.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-3.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    3
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">Restart & Enjoy</p>
                    <p className="mt-0.5 text-muted-foreground">Restart Claude Desktop. The hammer 🔨 icon will show 17 Kinetix tools!</p>
                  </div>
                </div>
              </div>

              {/* Operating System File Location Picker */}
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileTextIcon className="size-4 text-primary" />
                    <span>How to open config on your operating system:</span>
                  </div>
                  <div className="flex items-center rounded-md border border-border bg-background p-0.5">
                    <button
                      onClick={() => setClientOs("windows")}
                      className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        clientOs === "windows" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      Windows
                    </button>
                    <button
                      onClick={() => setClientOs("mac")}
                      className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        clientOs === "mac" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      macOS
                    </button>
                    <button
                      onClick={() => setClientOs("linux")}
                      className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        clientOs === "linux" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                      }`}
                    >
                      Linux
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  {clientOs === "windows" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
                        <div>
                          <span className="font-semibold text-foreground">File Path:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">%APPDATA%\Claude\claude_desktop_config.json</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy("%APPDATA%\\Claude\\claude_desktop_config.json", "claude-win-path")}
                        >
                          {copiedField === "claude-win-path" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                        <div>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">Quick 1-Click Open Command:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">notepad %APPDATA%\Claude\claude_desktop_config.json</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopy("notepad %APPDATA%\\Claude\\claude_desktop_config.json", "claude-win-cmd")}
                        >
                          {copiedField === "claude-win-cmd" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                          Copy Command
                        </Button>
                      </div>
                    </div>
                  )}

                  {clientOs === "mac" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
                        <div>
                          <span className="font-semibold text-foreground">File Path:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">~/Library/Application Support/Claude/claude_desktop_config.json</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy("~/Library/Application Support/Claude/claude_desktop_config.json", "claude-mac-path")}
                        >
                          {copiedField === "claude-mac-path" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                        <div>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">Quick 1-Click Open Command:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">open -a TextEdit ~/Library/Application\ Support/Claude/claude_desktop_config.json</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopy("open -a TextEdit ~/Library/Application\\ Support/Claude/claude_desktop_config.json", "claude-mac-cmd")}
                        >
                          {copiedField === "claude-mac-cmd" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                          Copy Command
                        </Button>
                      </div>
                    </div>
                  )}

                  {clientOs === "linux" && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
                        <div>
                          <span className="font-semibold text-foreground">File Path:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">~/.config/Claude/claude_desktop_config.json</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCopy("~/.config/Claude/claude_desktop_config.json", "claude-linux-path")}
                        >
                          {copiedField === "claude-linux-path" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                        <div>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">Quick 1-Click Open Command:</span>
                          <p className="font-mono text-[11px] text-muted-foreground">xdg-open ~/.config/Claude/claude_desktop_config.json</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleCopy("xdg-open ~/.config/Claude/claude_desktop_config.json", "claude-linux-cmd")}
                        >
                          {copiedField === "claude-linux-cmd" ? <CheckIcon className="size-3 text-emerald-500" /> : <CopyIcon className="size-3" />}
                          Copy Command
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* JSON Snippet */}
              <div className="relative">
                <div className="flex items-center justify-between rounded-t-lg border-x border-t border-border bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>claude_desktop_config.json</span>
                    {createdKey ? (
                      <Badge variant="secondary" className="gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px]">
                        <CheckCircle2Icon className="size-3" />
                        Live Token Injected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        Placeholder Token
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-foreground"
                    onClick={() => handleCopy(stdioJsonConfig, "claude-config")}
                  >
                    {copiedField === "claude-config" ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Configuration
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-56 overflow-x-auto rounded-b-lg border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                  {stdioJsonConfig}
                </pre>
              </div>
            </div>
          )}

          {/* Claude Code CLI Guide */}
          {activeTab === "claude-code" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs">
                <p className="font-semibold text-foreground">One-Line Terminal Command for Claude Code CLI:</p>
                <p className="mt-1 text-muted-foreground">
                  Run this single command in your terminal. Claude Code will automatically register the Kinetix MCP server and persist your credentials.
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between rounded-t-lg border-x border-t border-border bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>Terminal Command</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-foreground"
                    onClick={() => handleCopy(claudeCodeCommand, "claude-code-cmd")}
                  >
                    {copiedField === "claude-code-cmd" ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Command
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-40 overflow-x-auto rounded-b-lg border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                  {claudeCodeCommand}
                </pre>
              </div>
            </div>
          )}

          {/* Cursor Guide */}
          {activeTab === "cursor" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs">
                <p className="font-semibold text-foreground">How to enable in Cursor:</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
                  <li>Open <strong>Cursor Settings</strong> &rarr; <strong>Features</strong> &rarr; <strong>MCP</strong>.</li>
                  <li>Click <strong>+ Add New MCP Server</strong> (or create a <code className="rounded bg-background px-1 py-0.5 font-mono">.cursor/mcp.json</code> file in your workspace root).</li>
                  <li>Paste the configuration snippet below.</li>
                </ol>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between rounded-t-lg border-x border-t border-border bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>.cursor/mcp.json snippet</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-foreground"
                    onClick={() => handleCopy(stdioJsonConfig, "cursor-config")}
                  >
                    {copiedField === "cursor-config" ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Configuration
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-56 overflow-x-auto rounded-b-lg border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                  {stdioJsonConfig}
                </pre>
              </div>
            </div>
          )}

          {/* Windsurf Guide */}
          {activeTab === "windsurf" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs">
                <p className="font-semibold text-foreground">How to enable in Windsurf (Codeium):</p>
                <p className="mt-1 text-muted-foreground">
                  Add the snippet below to <code className="rounded bg-background px-1 py-0.5 font-mono">~/.codeium/windsurf/mcp_config.json</code> and reload the editor window.
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between rounded-t-lg border-x border-t border-border bg-muted/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>mcp_config.json snippet</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-foreground"
                    onClick={() => handleCopy(stdioJsonConfig, "windsurf-config")}
                  >
                    {copiedField === "windsurf-config" ? (
                      <>
                        <CheckIcon className="size-3 text-emerald-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy Configuration
                      </>
                    )}
                  </Button>
                </div>
                <pre className="max-h-56 overflow-x-auto rounded-b-lg border border-border bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
                  {stdioJsonConfig}
                </pre>
              </div>
            </div>
          )}

          {/* Remote / SSE Guide */}
          {activeTab === "sse" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-xs">
                <p className="font-semibold text-foreground">Remote Agent & Server-Sent Events (SSE) Endpoint:</p>
                <p className="mt-1 text-muted-foreground">
                  Connect remote LLM servers, OpenAI Assistants, LangChain, or custom web agents over HTTP using the standardized MCP SSE transport.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">SSE Connection URL (Supports both Header & ?token= query param)</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input readOnly value={sseUrl} className="font-mono text-xs" />
                    <Button variant="outline" size="sm" onClick={() => handleCopy(sseUrl, "sse-url")}>
                      {copiedField === "sse-url" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Authentication Header</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input readOnly value={`Authorization: Bearer ${tokenToDisplay}`} className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(`Authorization: Bearer ${tokenToDisplay}`, "sse-auth")}
                    >
                      {copiedField === "sse-auth" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Quick cURL Verification Command</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      readOnly
                      value={`curl -N -H "Authorization: Bearer ${tokenToDisplay}" ${sseUrl}`}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(`curl -N -H "Authorization: Bearer ${tokenToDisplay}" ${sseUrl}`, "sse-curl")}
                    >
                      {copiedField === "sse-curl" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Non-Tech User Prompt Cheatsheet ("Try It Out In Your AI Chat") */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">Try It Out: Ready-To-Use Prompts</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Not sure what to ask? Copy any of these verified prompts into your connected AI chat to see Kinetix in action.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {STARTER_PROMPTS.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-xl border border-border/80 bg-background/60 p-4 transition-all hover:border-primary/40 hover:bg-background"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{item.title}</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">{item.subtitle}</Badge>
                </div>
                <p className="mt-2 text-xs italic text-muted-foreground leading-relaxed">
                  "{item.prompt}"
                </p>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => handleCopy(item.prompt, `starter-${idx}`)}
                >
                  {copiedField === `starter-${idx}` ? (
                    <>
                      <CheckIcon className="size-3 text-emerald-500" />
                      Copied Prompt!
                    </>
                  ) : (
                    <>
                      <CopyIcon className="size-3" />
                      Copy Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Personal Access Tokens Table */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Active Connection Tokens (PATs)</h3>
            <p className="text-xs text-muted-foreground">Manage authorized keys connected to your account.</p>
          </div>
          <Button variant="outline" size="icon-sm" onClick={fetchKeys} disabled={loading} title="Refresh tokens">
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading tokens...</div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-8 text-center">
              <KeyIcon className="size-8 text-muted-foreground/40" />
              <p className="mt-2 text-xs font-medium text-foreground">No active tokens</p>
              <p className="text-xs text-muted-foreground">Generate your first token above to connect your AI assistant.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {keys.map((k) => (
                <div key={k.id} className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{k.name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {k.keyPrefix}
                      </code>
                      <Badge variant="outline" className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <span className="size-1 rounded-full bg-emerald-500" />
                        Active
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Created {k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "recently"}</span>
                      <span>&bull;</span>
                      <span>{k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
                      {k.expiresAt && (
                        <>
                          <span>&bull;</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            Expires {new Date(k.expiresAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => {
                        setDiagToken(k.keyPrefix);
                        setIsDiagOpen(true);
                        runDiagnostics(k.keyPrefix);
                      }}
                    >
                      <PlayCircleIcon className="size-3.5 text-primary" />
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRevoke(k.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capabilities Explorer with Search & Filter */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <WrenchIcon className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Verified Capabilities & Tools (17 Tools)</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Click any tool to view parameters, descriptions, and prompt examples.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                className="h-8 w-44 pl-8 text-xs sm:w-56"
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
              />
            </div>
            <Select value={toolCategory} onValueChange={(v) => v && setToolCategory(v)}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="workspace">Workspace</SelectItem>
                <SelectItem value="tasks">Tasks</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="feed">Feed</SelectItem>
                <SelectItem value="search">Search</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <div
              key={tool.name}
              onClick={() => setSelectedTool(tool)}
              className="group flex flex-col justify-between rounded-xl border border-border bg-background p-3.5 transition-all hover:border-primary/40 hover:shadow-xs cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <code className="text-xs font-semibold text-primary group-hover:underline">
                    {tool.name}
                  </code>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {tool.category}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                <span>View Details</span>
                <ChevronRightIcon className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tool Detail Dialog */}
      <Dialog open={!!selectedTool} onOpenChange={(open) => !open && setSelectedTool(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-mono text-primary">
              <WrenchIcon className="size-4" />
              {selectedTool?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTool?.description}
            </DialogDescription>
          </DialogHeader>

          {selectedTool && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-semibold">Category</Label>
                <div>
                  <Badge variant="secondary" className="uppercase">{selectedTool.category}</Badge>
                </div>
              </div>

              {selectedTool.params && (
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground font-semibold">Accepted Parameters</Label>
                  <pre className="rounded-lg border border-border bg-muted p-2.5 font-mono text-[11px] text-foreground">
                    {selectedTool.params}
                  </pre>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-muted-foreground font-semibold">Example User Prompt to Trigger This Tool</Label>
                <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="italic text-foreground">"{selectedTool.examplePrompt}"</p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    onClick={() => handleCopy(selectedTool.examplePrompt, "tool-prompt")}
                  >
                    {copiedField === "tool-prompt" ? <CheckIcon className="size-3.5 text-emerald-500" /> : <CopyIcon className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTool(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createdKey ? "Token Generated Successfully" : "Generate Connection Token"}</DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copy this key now. For your security, you will not be able to see it again!"
                : "Create a dedicated personal access token for your AI assistant or agent."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="size-4 shrink-0" />
                  <span>Make sure to copy this token right now. It won't be displayed again once you close this dialog.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Your Personal Access Token</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={createdKey.token} className="font-mono text-xs font-semibold text-foreground select-all" />
                  <Button
                    size="sm"
                    className="gap-1 px-3"
                    onClick={() => handleCopy(createdKey.token, "modal-token")}
                  >
                    {copiedField === "modal-token" ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                    Copy
                  </Button>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setDiagToken(createdKey.token);
                    setIsCreateOpen(false);
                    setIsDiagOpen(true);
                    runDiagnostics(createdKey.token);
                  }}
                >
                  <PlayCircleIcon className="size-4 text-primary mr-1" />
                  Test This Token
                </Button>
                <Button className="flex-1" onClick={() => setIsCreateOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="token-name">Token Name / Purpose</Label>
                <Input
                  id="token-name"
                  placeholder="e.g. Claude Desktop (Home Mac), Cursor Laptop"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-workspace">Workspace Scope</Label>
                <Select value={targetWorkspaceId} onValueChange={(v) => v && setTargetWorkspaceId(v)}>
                  <SelectTrigger id="token-workspace">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accessible Workspaces</SelectItem>
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-expiry">Expiration</Label>
                <Select value={expiryDays} onValueChange={(v) => v && setExpiryDays(v)}>
                  <SelectTrigger id="token-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days (Recommended)</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="never">Never expire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? "Generating..." : "Generate Token"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diagnostics / Verification Dialog */}
      <Dialog open={isDiagOpen} onOpenChange={setIsDiagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-primary" />
              Live Connection Diagnostics
            </DialogTitle>
            <DialogDescription>
              Test if your token and workspace context resolve properly before configuring your AI tool.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Token to test</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Paste your knx_pat_... token here"
                  value={diagToken}
                  onChange={(e) => setDiagToken(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => runDiagnostics()}
                  disabled={testingDiag || !diagToken.trim()}
                >
                  {testingDiag ? "Testing..." : "Verify"}
                </Button>
              </div>
            </div>

            {diagResult && (
              <div
                className={`rounded-xl border p-4 text-xs ${
                  diagResult.valid
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {diagResult.valid ? (
                    <CheckCircle2Icon className="size-5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircleIcon className="size-5 shrink-0 text-destructive" />
                  )}
                  <div className="space-y-1">
                    <p className="font-semibold">{diagResult.valid ? "Connection Verified!" : "Verification Failed"}</p>
                    <p className="text-xs opacity-90">{diagResult.message}</p>
                    {diagResult.valid && diagResult.workspace && (
                      <div className="mt-2 space-y-0.5 border-t border-emerald-500/20 pt-2 font-mono text-[11px]">
                        <div>User: {diagResult.user?.name} ({diagResult.user?.email})</div>
                        <div>Workspace: {diagResult.workspace.name} ({diagResult.workspace.role})</div>
                        <div>Available Tools: 17 Verified Tools Ready</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setIsDiagOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import React, {
  createContext,
  useContext,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CopilotKitProvider,
  CopilotChat,
  useRenderTool,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { HttpAgent } from "@ag-ui/client";
import { z } from "zod";
import {
  ArrowDownToLine,
  Check,
  CircleAlert,
  LoaderCircle,
  Wrench,
  Square,
  SquarePen,
} from "lucide-react";
import "@copilotkit/react-core/v2/styles.css";

const WorkspaceContext = createContext({ runs: [] });
const busyStates = new Set([
  "queued",
  "analyzing",
  "editing",
  "rendering",
  "repairing",
  "reviewing",
  "polishing",
]);
const progressLabels = {
  queued: "Edit queued",
  analyzing: "Understanding your footage",
  editing: "Building your edit",
  rendering: "Rendering your video",
  repairing: "Refining your edit",
  reviewing: "Reviewing your video",
  polishing: "Polishing your video",
};
const parseResult = (result) => {
  try {
    return JSON.parse(result || "{}");
  } catch {
    return {};
  }
};

function ReelResult({ run, onAction }) {
  const busy = busyStates.has(run.status);
  const version = run.versions.at(-1);
  const failed = ["failed", "cancelled", "interrupted"].includes(run.status);
  return (
    <div className="reel-result">
      <div className="result-heading" role="status">
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : run.status === "ready" ? (
          <Check size={16} />
        ) : (
          <CircleAlert size={16} />
        )}
        <strong>
          {busy
            ? progressLabels[run.status]
            : run.status === "ready"
              ? "Video ready"
              : run.status === "needs_review"
                ? "Video needs review"
                : run.status.replaceAll("_", " ")}
        </strong>
      </div>
      <p>
        {busy
          ? "Your edit continues while you chat. Originals stay untouched."
          : run.error ||
            (version
              ? `${version.plan.title} · ${version.plan.duration.toFixed(0)}s · ${version.plan.clips.length} shots`
              : "No video was rendered.")}
      </p>
      {!busy && version?.review && (
        <p className="result-review">
          {version.review.passed
            ? "Technical and visual review passed."
            : "Review findings remain. Check the tool results before sharing."}
        </p>
      )}
      <div className="result-actions">
        <button onClick={() => onAction({ runId: run.id })}>
          View {busy ? "progress" : "video"}
        </button>
        {!busy && version && (
          <a href={version.url} download={`cutroom-${run.id.slice(0, 8)}.mp4`}>
            <ArrowDownToLine size={14} /> Download MP4
          </a>
        )}
        {!busy && version && (
          <button
            onClick={() => onAction({ runId: run.id, command: "save_reel" })}
          >
            Save to folder…
          </button>
        )}
        {busy && (
          <button
            onClick={() => onAction({ command: "stop_run", runId: run.id })}
          >
            <Square size={12} /> Stop edit
          </button>
        )}
      </div>
      {failed && (
        <small>
          Ask the copilot to create a new video or revise an earlier completed
          cut.
        </small>
      )}
      <ToolActivity run={run} />
    </div>
  );
}
function ToolReceipt({ result, parameters }) {
  const { runs, onAction } = useContext(WorkspaceContext);
  const data = parseResult(result);
  const run = runs.find((r) => r.id === data.runId);
  if (data.error)
    return (
      <div className="copilot-tool-receipt tool-error" role="alert">
        <CircleAlert size={16} /> {data.error}
      </div>
    );
  return (
    <div className="copilot-tool-receipt">
      {run ? (
        <ReelResult run={run} onAction={onAction} />
      ) : (
        <div className="result-heading">
          <LoaderCircle size={15} className="spin" />
          <strong>{result ? "Loading edit…" : "Starting your video…"}</strong>
        </div>
      )}
      <details className="receipt-brief">
        <summary>Editing instructions</summary>
        <p>{parameters?.feedback || parameters?.brief}</p>
      </details>
    </div>
  );
}
function UtilityReceipt({ result, label }) {
  const data = parseResult(result);
  return (
    <div className={`copilot-tool-receipt ${data.error ? "tool-error" : ""}`}>
      <strong>
        {data.error ? "Needs attention" : result ? label : "Working…"}
      </strong>
      {data.error && <p>{data.error}</p>}
      {data.url && (
        <>
          <p>
            {data.title}
            {data.reviewPassed
              ? " · Review passed"
              : " · Check review findings before sharing"}
          </p>
          <a
            className="button secondary"
            href={data.url}
            download="cutroom-reel.mp4"
          >
            <ArrowDownToLine size={14} /> Download MP4
          </a>
        </>
      )}
    </div>
  );
}
function RegisteredChat({ workspaceState, onAction, onError, chatEpoch }) {
  const { agent } = useAgent({ agentId: "editor" });
  const { copilotkit } = useCopilotKit();
  const [sending, setSending] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [conversationKey, setConversationKey] = useState(0);
  const [previousConversation, setPreviousConversation] = useState(null);
  const lastChatEpoch = useRef(chatEpoch);
  const resetConversation = useCallback(
    (allowUndo = true) => {
      const previous = {
        messages: [...agent.messages],
        threadId: agent.threadId,
      };
      const nextThreadId = crypto.randomUUID();
      try {
        if (previous.messages.length) {
          localStorage.setItem(
            `cutroom-chat-archive-${Date.now()}-${previous.threadId}`,
            JSON.stringify(previous),
          );
        }
        localStorage.setItem("cutroom-chat-v2", "[]");
        localStorage.setItem("cutroom-chat-thread", nextThreadId);
      } catch {
        onError(
          "Could not save the conversation locally. Free some browser storage and try again; your chat has not been cleared.",
        );
        return;
      }
      agent.abortRun();
      agent.threadId = nextThreadId;
      agent.setMessages([]);
      setSuggestion(null);
      setPreviousConversation(allowUndo ? previous : null);
      setConversationKey((key) => key + 1);
      onError("");
    },
    [agent, onError],
  );
  const restoreConversation = () => {
    if (!previousConversation) return;
    try {
      localStorage.setItem(
        "cutroom-chat-v2",
        JSON.stringify(previousConversation.messages),
      );
      localStorage.setItem(
        "cutroom-chat-thread",
        previousConversation.threadId,
      );
    } catch {
      onError("Could not restore the saved conversation. Please try again.");
      return;
    }
    agent.threadId = previousConversation.threadId;
    agent.setMessages(previousConversation.messages);
    setPreviousConversation(null);
    setConversationKey((key) => key + 1);
    onError("");
  };
  const { runs } = useContext(WorkspaceContext);
  const activeRun = runs.find((run) => run.id === workspaceState.runId);
  const editing = activeRun && busyStates.has(activeRun.status);
  useEffect(
    () => setSuggestion(null),
    [workspaceState.runId, editing, chatEpoch],
  );
  useEffect(() => {
    if (chatEpoch === lastChatEpoch.current) return;
    lastChatEpoch.current = chatEpoch;
    resetConversation(false);
  }, [chatEpoch, resetConversation]);
  useEffect(() => {
    const subscription = agent.subscribe({
      onMessagesChanged: ({ messages }) => {
        try {
          localStorage.setItem("cutroom-chat-v2", JSON.stringify(messages));
        } catch {}
      },
      onToolCallResultEvent: ({ event }) => {
        const result = parseResult(event.content);
        if (!result.error && (result.runId || result.command)) onAction(result);
      },
      onRunStartedEvent: () => {
        setPreviousConversation(null);
        onError("");
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, onAction, onError]);
  useEffect(() => {
    agent.setState(workspaceState);
  }, [agent, workspaceState]);
  useRenderTool(
    {
      name: "create_reel",
      parameters: z.object({ brief: z.string(), targetDuration: z.number() }),
      render: (props) => <ToolReceipt {...props} />,
    },
    [],
  );
  useRenderTool(
    {
      name: "edit_reel",
      parameters: z.object({ feedback: z.string(), parentRunId: z.string() }),
      render: (props) => <ToolReceipt {...props} />,
    },
    [],
  );
  useRenderTool(
    {
      name: "plan_day",
      parameters: z.object({ feedback: z.string() }),
      render: (props) => <UtilityReceipt {...props} label="Story plan saved" />,
    },
    [],
  );
  useRenderTool(
    {
      name: "export_reel",
      parameters: z.object({}),
      render: (props) => <UtilityReceipt {...props} label="Rendered video" />,
    },
    [],
  );
  useRenderTool(
    {
      name: "workspace_action",
      parameters: z.object({ command: z.string() }),
      render: (props) => (
        <UtilityReceipt {...props} label="Workspace updated" />
      ),
    },
    [],
  );
  useRenderTool(
    {
      name: "stop_edit",
      parameters: z.object({ runId: z.string().nullable() }),
      render: (props) => (
        <UtilityReceipt
          {...props}
          label={
            parseResult(props.result).stopped
              ? "Stop requested"
              : "No running edit selected"
          }
        />
      ),
    },
    [],
  );
  const send = async (text) => {
    if (agent.isRunning || sending) return;
    setSending(true);
    setPreviousConversation(null);
    onError("");
    try {
      agent.setState(workspaceState);
      agent.addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      });
      await copilotkit.runAgent({ agent });
    } catch (e) {
      onError(e.message);
    } finally {
      setSending(false);
    }
  };
  const explain = [
    "Explain the story",
    "Explain the main story of this reel, why you chose this shot order, and what makes the opening work. Keep it to three short points for my live demo. Do not change or render anything.",
  ];
  const prompts = editing
    ? [
        [
          "Explain this edit",
          "Briefly explain the current editing plan and what has actually finished so far. Do not queue another edit.",
        ],
        ["Focus on the video", "Hide the library so I can focus on the video."],
      ]
    : workspaceState.runId
      ? [
          [
            "Demo 2 · Match colors",
            "Make the indoor shots match the outdoor shots more naturally. Keep the same cuts, timing, and title. Render and review the updated video.",
          ],
          explain,
          [
            "Stronger opening",
            "Revise this reel with a stronger opening using the existing footage. Keep the same duration, preserve natural colors, and render and review the new version.",
          ],
          ["Add voiceover", "Open the voiceover controls for this video."],
          ["Download the reel", "Give me the finished MP4 for this reel."],
        ]
      : [
          [
            "Demo 1 · Create reel",
            "Create a 15-second vertical reel about my day at the Gemini Argon hackathon. Start with arriving, show me building, and end with a human moment. Keep the original sound and use one minimal opening title.",
          ],
          [
            "Find the story",
            "Plan the main story for this footage and show me a visual storyboard. Explain the hook and how to arrange the shots.",
          ],
          [
            "Create a video",
            `Create a new ${workspaceState.targetDuration}-second video from my ${workspaceState.assetIds.length ? "selected footage" : "library"}. Find the strongest story, render it, review it, and polish the final video.`,
          ],
          [
            "Use my story plan",
            `Create a new ${workspaceState.targetDuration}-second video using the saved story plan and its shot sequence. Render, review, and polish it.`,
          ],
        ];
  return (
    <>
      <div className="conversation-controls">
        <button
          onClick={() => resetConversation()}
          disabled={sending || agent.isRunning}
          title="Clear the chat and start fresh. Your current video stays open."
        >
          <SquarePen size={14} /> New conversation
        </button>
        {previousConversation && (
          <span role="status">
            Chat cleared.
            <button onClick={restoreConversation}>Undo</button>
          </span>
        )}
      </div>
      <div className="copilot-suggestions">
        <div className="suggestion-heading">
          <span>Try asking</span>
          <details className="demo-guide">
            <summary>Live demo guide</summary>
            <ol>
              <li>
                <strong>Create.</strong> Choose Demo 1 · Create reel, preview
                the prompt, then Send prompt.
              </li>
              <li>
                <strong>Watch.</strong> Show the live Tool calls & decisions.
                Wait for Video ready, then play a few seconds.
              </li>
              <li>
                <strong>Edit once.</strong> Choose Demo 2 · Match colors, then
                Send prompt. It preserves the cuts, timing, and title.
              </li>
              <li>
                <strong>Deliver.</strong> Wait for the updated video, play it,
                then click Download MP4 in the result card.
              </li>
            </ol>
            <p>
              Short on time? Use the finished reel: Explain the story → play the
              video → Download the reel. New renders take time.
            </p>
          </details>
        </div>
        <p className="suggestion-hint">
          {editing
            ? "While Argon works, explain the plan and show the live tool calls."
            : workspaceState.runId
              ? "Demo step 2: match the colors, then play and download the result."
              : "Demo step 1: create a 15-second hackathon reel. Color editing comes next."}
        </p>
        <div className="copilot-quick-actions" aria-label="Suggested prompts">
          {prompts.map(([label, prompt]) => (
            <button
              key={label}
              aria-pressed={suggestion?.[0] === label}
              disabled={sending || agent.isRunning}
              onClick={() =>
                setSuggestion(
                  suggestion?.[0] === label ? null : [label, prompt],
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        {suggestion && (
          <div className="suggestion-preview">
            <p>{suggestion[1]}</p>
            <div>
              <button onClick={() => setSuggestion(null)}>Cancel</button>
              <button
                className="suggestion-send"
                disabled={sending || agent.isRunning}
                onClick={() => {
                  const prompt = suggestion[1];
                  setSuggestion(null);
                  send(prompt);
                }}
              >
                Send prompt
              </button>
            </div>
          </div>
        )}
      </div>
      <CopilotChat
        key={conversationKey}
        agentId="editor"
        inspectorTools={false}
        labels={{
          welcomeMessageText: workspaceState.runId
            ? "What would you like to change?"
            : "What story should we make?",
          chatInputPlaceholder:
            "Create a video, adjust a shot, or plan a story…",
          chatDisclaimerText:
            "Argon directs the edit. Rendering stays on your Mac.",
        }}
      />
    </>
  );
}
export function ToolActivity({ run, expanded = false }) {
  return (
    <details className="tool-activity" open={expanded || undefined}>
      <summary>
        <Wrench size={12} />
        Tool calls & decisions <span>{run.toolCalls?.length || 0}</span>
      </summary>
      {(run.toolCalls || []).map((call) => (
        <div className="tool-call" key={call.id}>
          <strong>{call.name.replaceAll("_", " ")}</strong>
          <span>{call.status}</span>
          <p>
            {call.arguments?.rationale ||
              (call.name === "review_edit"
                ? call.result?.visual?.summary
                : call.arguments?.title)}
          </p>
          {call.result?.error && (
            <p className="tool-error">{call.result.error}</p>
          )}
          <details>
            <summary>Parameters and result</summary>
            <pre>
              {JSON.stringify(
                { parameters: call.arguments, result: call.result },
                null,
                2,
              )}
            </pre>
          </details>
        </div>
      ))}
      {(run.events || [])
        .filter((e) =>
          ["discovery", "color", "issue", "error"].includes(e.type),
        )
        .slice(-8)
        .map((e) => (
          <div key={e.id} className="decision-note">
            <strong>{e.title}</strong>
            <p>{e.detail}</p>
          </div>
        ))}
    </details>
  );
}
export function CopilotPanel({
  run,
  current,
  selectedClip,
  runs,
  assetIds,
  assetCount,
  targetDuration,
  storyMode,
  startDate,
  endDate,
  libraryVisible,
  onAction,
  chatEpoch,
}) {
  const [error, setError] = useState("");
  const agents = useMemo(() => {
    let history = [];
    let threadId = "cutroom-local-editor";
    try {
      history = JSON.parse(localStorage.getItem("cutroom-chat-v2") || "[]");
      threadId = localStorage.getItem("cutroom-chat-thread") || threadId;
    } catch {}
    return {
      editor: new HttpAgent({
        url: "/api/copilot",
        agentId: "editor",
        threadId,
        initialMessages: history,
      }),
    };
  }, []);
  const workspaceState = useMemo(
    () => ({
      runId: run?.id || null,
      version: run?.versions.some((v) => v.id === current?.id)
        ? current?.id
        : undefined,
      selectedClip: current ? selectedClip : null,
      assetIds,
      targetDuration,
      storyMode,
      startDate,
      endDate,
      libraryVisible,
    }),
    [
      run?.id,
      current?.id,
      selectedClip,
      assetIds,
      targetDuration,
      storyMode,
      startDate,
      endDate,
      libraryVisible,
    ],
  );
  return (
    <aside className="copilot-panel" aria-label="Editing copilot">
      <div className="copilot-title">
        <h2>Editing copilot</h2>
        <span>Argon 4</span>
      </div>
      <p className="copilot-context">
        {run
          ? `${current?.plan.title || "Video in progress"}${busyStates.has(run.status) ? ` · ${progressLabels[run.status]}` : selectedClip !== null && current ? ` · Shot ${selectedClip + 1}` : ""}`
          : `New video · ${assetIds.length || assetCount} ${assetIds.length ? "selected" : "available"} moments · ${targetDuration}s`}
      </p>
      <WorkspaceContext.Provider value={{ runs, onAction }}>
        <CopilotKitProvider
          selfManagedAgents={agents}
          agentId="editor"
          showDevConsole={false}
          enableInspector={false}
          onError={(event) => setError(event.error.message)}
        >
          <RegisteredChat
            workspaceState={workspaceState}
            onAction={onAction}
            onError={setError}
            chatEpoch={chatEpoch}
          />
        </CopilotKitProvider>
      </WorkspaceContext.Provider>
      {error && (
        <p className="form-error" role="alert">
          {error}
          <button
            aria-label="Dismiss copilot error"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </p>
      )}
    </aside>
  );
}

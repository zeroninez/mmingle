"use client";

/**
 * 이 파일은 OpenAI 어시스턴트 API를 사용한 채팅 인터페이스를 구현합니다.
 * 관리자 시스템과 연동되어 특정 관리자의 대화로 저장됩니다.
 * 사용자가 시작 버튼을 클릭할 때 대화가 생성되고, 완료 버튼으로 인터뷰를 종료합니다.
 */

import React, { useState, useEffect, useRef } from "react";
import { AssistantStream } from "openai/lib/AssistantStream";
import Markdown from "react-markdown";
// @ts-expect-error - no types for this yet
import { AssistantStreamEvent } from "openai/resources/beta/assistants/assistants";
import { RequiredActionFunctionToolCall } from "openai/resources/beta/threads/runs/runs";
import {
  createConversation,
  saveMessage,
  getActiveInterviewTemplate,
} from "@/supabase";
import { removeFlagsFromText } from "@/hooks";

type MessageProps = {
  role: "user" | "assistant" | "code" | "typing";
  text: string;
  displayText?: string;
};

const UserMessage = ({ text }: { text: string }) => (
  <div className="self-end text-white bg-black rounded-2xl py-2 px-4 max-w-[80%] break-words">
    {text}
  </div>
);

const AssistantMessage = ({ text }: { text: string }) => (
  <div className="self-start bg-gray-100 rounded-2xl py-2 px-4 max-w-[80%] break-words">
    <Markdown className="[&_img]:max-w-full [&_img]:my-2 [&_img]:rounded-lg">
      {text}
    </Markdown>
  </div>
);

const CodeMessage = ({ text }: { text: string }) => (
  <div className="self-start bg-gray-200 rounded-2xl py-2.5 px-4 max-w-[80%] break-words font-mono [counter-reset:line]">
    {text.split("\n").map((line, index) => (
      <div key={index} className="mt-1">
        <span className="text-gray-400 mr-2">{`${index + 1}. `}</span>
        {line}
      </div>
    ))}
  </div>
);

const TypingMessage = () => (
  <div className="self-start bg-gray-100 rounded-2xl py-2 px-4 max-w-[80%]">
    <div className="flex items-center h-6">
      <div className="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
);

const Message = ({ role, text, displayText }: MessageProps) => {
  const shownText = displayText ?? removeFlagsFromText(text);
  switch (role) {
    case "user":
      return <UserMessage text={shownText} />;
    case "assistant":
      return <AssistantMessage text={shownText} />;
    case "code":
      return <CodeMessage text={shownText} />;
    case "typing":
      return <TypingMessage />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: RequiredActionFunctionToolCall,
  ) => Promise<string>;
  showBreadcrumbs?: boolean;
  adminId: string; // 관리자 ID
  userIdentifier?: string; // 사용자 식별자
};

const Chat = ({
  functionCallHandler = () => Promise.resolve(""),
  showBreadcrumbs = false,
  adminId,
  userIdentifier,
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);
  const [threadId, setThreadId] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firstMessageSent, setFirstMessageSent] = useState(false);
  const [isThreadInitialized, setIsThreadInitialized] = useState(false);
  const [adminInterviewData, setAdminInterviewData] = useState<any>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [noTemplateError, setNoTemplateError] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null,
  );

  // 인터뷰 상태 관리
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);
  const [completingInterview, setCompletingInterview] = useState(false);

  // 현재 처리 중인 assistant 메시지를 추적하기 위한 ref
  const currentAssistantMessageRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 스레드 초기화 및 템플릿 로드
  useEffect(() => {
    if (isThreadInitialized || !adminId) {
      return;
    }

    const initializeThread = async () => {
      console.log("스레드 초기화 시작 - adminId:", adminId);
      setIsLoading(true);
      setIsThreadInitialized(true);

      try {
        // 1. 스레드 생성
        console.log("스레드 생성 중...");
        const threadRes = await fetch(`/api/assistants/threads`, {
          method: "POST",
        });
        const threadData = await threadRes.json();
        console.log("스레드 생성 완료:", threadData.threadId);
        setThreadId(threadData.threadId);

        // 2. 관리자의 활성 인터뷰 템플릿 로드
        console.log("관리자 인터뷰 템플릿 로드 중...");
        setTemplateLoading(true);
        const activeTemplate = await getActiveInterviewTemplate(adminId);

        if (activeTemplate) {
          setAdminInterviewData(activeTemplate.template_data);
          setCurrentTemplateId(activeTemplate.id);
          console.log("관리자 템플릿 로드 완료:", activeTemplate.title);

          // 3. 대기 메시지 표시
          const waitingMessage = {
            role: "assistant" as const,
            text: `안녕하세요! "${activeTemplate.title}" 인터뷰에 참여해 주셔서 감사합니다.\n\n시작 버튼을 눌러 인터뷰를 시작해 주세요.`,
          };

          setMessages([waitingMessage]);
          console.log("초기화 완료 - 시작 버튼 대기 중");
        } else {
          console.log("활성 템플릿이 없음 - 인터뷰 진행 불가");
          setNoTemplateError(true);
        }
        setTemplateLoading(false);
      } catch (error) {
        console.error("스레드 초기화 중 오류 발생:", error);
        setMessages([
          {
            role: "assistant",
            text: "인터뷰를 준비하는 중 문제가 발생했습니다. 새로고침 후 다시 시도해주세요.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeThread();
  }, [adminId, userIdentifier, isThreadInitialized]);

  // 대화 생성 함수
  const createConversationIfNeeded = async () => {
    if (conversationId) {
      return conversationId;
    }

    console.log("대화 레코드 생성 중...");
    const conversationResult = await createConversation(
      adminId,
      threadId,
      userIdentifier,
      currentTemplateId || undefined,
    );

    if (conversationResult.success && conversationResult.data) {
      console.log("대화 레코드 생성 완료:", conversationResult.data.id);
      setConversationId(conversationResult.data.id);
      return conversationResult.data.id;
    } else {
      console.error("대화 생성 실패:", conversationResult.error);
      throw new Error(conversationResult.error || "대화 생성에 실패했습니다.");
    }
  };

  // 인터뷰 시작 함수
  const handleStartInterview = async () => {
    if (!threadId) return;

    setStartingInterview(true);
    try {
      // 대화 생성
      const newConversationId = await createConversationIfNeeded();

      // 인터뷰 시작 API 호출
      const response = await fetch(
        `/api/conversations/${newConversationId}/start`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setInterviewStarted(true);
        setInputDisabled(true); // 입력 즉시 비활성화

        // 환영 메시지
        let initialMessage =
          "안녕하세요! UX 서비스 기획을 위한 사용자 인터뷰를 시작하겠습니다.";
        if (userIdentifier) {
          initialMessage += `\n\n${userIdentifier}님, 만나서 반갑습니다!`;
        }

        await saveMessage(newConversationId, "assistant", initialMessage);

        // 환영 메시지 + 즉시 타이핑 표시
        setMessages([
          { role: "assistant", text: initialMessage },
          { role: "typing", text: "" }, // 즉시 타이핑 표시
        ]);

        // Assistant 요청
        setTimeout(async () => {
          const jsonData = adminInterviewData;
          const startMessage = `인터뷰를 시작해주세요.\n\n-----\n다음 JSON 파일에 따라 인터뷰를 진행해주세요. \n\n\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\``;

          const assistantResponse = await fetch(
            `/api/assistants/threads/${threadId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({ content: startMessage }),
            },
          );

          if (assistantResponse.ok) {
            const stream = AssistantStream.fromReadableStream(
              assistantResponse.body,
            );
            handleReadableStream(stream);
            setFirstMessageSent(true);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("Error starting interview:", error);
      alert("인터뷰 시작 중 오류가 발생했습니다.");
      setInputDisabled(false); // 에러시 다시 활성화
    } finally {
      setStartingInterview(false);
    }
  };

  // 인터뷰 완료 함수
  const handleCompleteInterview = async () => {
    if (!conversationId || !window.confirm("인터뷰를 완료하시겠습니까?"))
      return;

    setCompletingInterview(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/complete`,
        {
          method: "POST",
        },
      );

      if (response.ok) {
        setInterviewCompleted(true);
        setInputDisabled(true);

        // 완료 메시지 추가
        const completeMessage =
          "인터뷰가 완료되었습니다. 소중한 시간을 내어 참여해 주셔서 감사합니다! 🎉";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: completeMessage },
        ]);

        // 완료 메시지도 DB에 저장
        await saveMessage(conversationId, "assistant", completeMessage);
      }
    } catch (error) {
      console.error("Error completing interview:", error);
      alert("인터뷰 완료 중 오류가 발생했습니다.");
    } finally {
      setCompletingInterview(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!threadId || !interviewStarted) {
      console.error("인터뷰가 시작되지 않았습니다.");
      return;
    }

    // UI에 사용자 메시지 추가
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", text: text },
    ]);

    // 타이핑 메시지 추가
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: "typing", text: "" },
    ]);

    try {
      // 사용자 메시지를 DB에 저장
      if (conversationId) {
        await saveMessage(conversationId, "user", text);
        console.log("사용자 메시지 DB 저장 완료");
      }

      // 메시지 전송
      let combinedMessage = text;

      // 첫 번째 메시지에 JSON 데이터를 함께 포함
      if (!firstMessageSent) {
        const jsonData = adminInterviewData;

        if (!jsonData) {
          throw new Error("인터뷰 템플릿이 설정되지 않았습니다.");
        }

        combinedMessage = `${text}\n\n-----\n다음 JSON 파일에 따라 인터뷰를 진행해주세요. \n\n\`\`\`json\n${JSON.stringify(jsonData, null, 2)}\n\`\`\``;
        setFirstMessageSent(true);
      }

      // Assistant API에 메시지 전송
      const response = await fetch(
        `/api/assistants/threads/${threadId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content: combinedMessage,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `API 요청 실패: ${response.status} ${response.statusText}`,
        );
      }

      const stream = AssistantStream.fromReadableStream(response.body);
      handleReadableStream(stream);
    } catch (apiError) {
      console.error("메시지 전송 중 오류:", apiError);
      setInputDisabled(false);

      setMessages((prevMessages) => {
        const messagesWithoutTyping = prevMessages.filter(
          (msg, idx) =>
            idx !== prevMessages.length - 1 || msg.role !== "typing",
        );
        return [
          ...messagesWithoutTyping,
          {
            role: "assistant",
            text: "메시지 전송 중 오류가 발생했습니다. 다시 시도해주세요.",
          },
        ];
      });
    }
  };

  const submitActionResult = async (runId: string, toolCallOutputs: any[]) => {
    try {
      const response = await fetch(
        `/api/assistants/threads/${threadId}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            runId: runId,
            toolCallOutputs: toolCallOutputs,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `API 요청 실패: ${response.status} ${response.statusText}`,
        );
      }

      const stream = AssistantStream.fromReadableStream(response.body);
      handleReadableStream(stream);
    } catch (error) {
      console.error("도구 출력 제출 중 오류:", error);
      setInputDisabled(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !threadId || !interviewStarted) return;

    sendMessage(userInput);
    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  /* 스트림 이벤트 핸들러 */
  const handleTextCreated = () => {
    currentAssistantMessageRef.current = "";

    setMessages((prevMessages) => {
      const messagesWithoutTyping = prevMessages.filter(
        (msg, idx) => idx !== prevMessages.length - 1 || msg.role !== "typing",
      );
      return [...messagesWithoutTyping, { role: "assistant", text: "" }];
    });
  };

  const handleTextDelta = (delta: any) => {
    if (delta.value != null) {
      currentAssistantMessageRef.current += delta.value;
      appendToLastMessage(delta.value);
    }
    if (delta.annotations != null) {
      annotateLastMessage(delta.annotations);
    }
  };

  const handleImageFileDone = (image: any) => {
    const imageText = `\n![${image.file_id}](/api/files/${image.file_id})\n`;
    currentAssistantMessageRef.current += imageText;
    appendToLastMessage(imageText);
  };

  const toolCallCreated = (toolCall: any) => {
    if (toolCall.type != "code_interpreter") return;

    currentAssistantMessageRef.current = "";

    setMessages((prevMessages) => {
      const messagesWithoutTyping = prevMessages.filter(
        (msg, idx) => idx !== prevMessages.length - 1 || msg.role !== "typing",
      );
      return [...messagesWithoutTyping, { role: "code", text: "" }];
    });
  };

  const toolCallDelta = (delta: any, snapshot: any) => {
    if (delta.type != "code_interpreter") return;
    if (!delta.code_interpreter.input) return;

    currentAssistantMessageRef.current += delta.code_interpreter.input;
    appendToLastMessage(delta.code_interpreter.input);
  };

  const handleRequiresAction = async (
    event: AssistantStreamEvent.ThreadRunRequiresAction,
  ) => {
    const runId = event.data.id;
    const toolCalls = event.data.required_action.submit_tool_outputs.tool_calls;
    const toolCallOutputs = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const result = await functionCallHandler(toolCall);
        return { output: result, tool_call_id: toolCall.id };
      }),
    );
    setInputDisabled(true);
    submitActionResult(runId, toolCallOutputs);
  };

  const handleRunCompleted = async () => {
    setInputDisabled(false);

    if (currentAssistantMessageRef.current.trim() && conversationId) {
      const messageContent = currentAssistantMessageRef.current.trim();

      const currentMessages = messages;
      const lastMessage = currentMessages[currentMessages.length - 1];

      if (
        lastMessage &&
        (lastMessage.role === "assistant" || lastMessage.role === "code")
      ) {
        try {
          await saveMessage(conversationId, lastMessage.role, messageContent);
          console.log(
            `${lastMessage.role} 메시지 DB 저장 완료:`,
            messageContent.substring(0, 50) + "...",
          );
        } catch (error) {
          console.error("메시지 저장 실패:", error);
        }
      }
    }

    currentAssistantMessageRef.current = "";
  };

  const handleReadableStream = (stream: AssistantStream) => {
    stream.on("textCreated", handleTextCreated);
    stream.on("textDelta", handleTextDelta);
    stream.on("imageFileDone", handleImageFileDone);
    stream.on("toolCallCreated", toolCallCreated);
    stream.on("toolCallDelta", toolCallDelta);
    stream.on("event", (event) => {
      if (event.event === "thread.run.requires_action")
        handleRequiresAction(event);
      if (event.event === "thread.run.completed") handleRunCompleted();
    });

    stream.on("error", (error) => {
      console.error("스트림 처리 중 오류:", error);
      setInputDisabled(false);
      currentAssistantMessageRef.current = "";

      setMessages((prevMessages) => {
        const messagesWithoutTyping = prevMessages.filter(
          (msg, idx) =>
            idx !== prevMessages.length - 1 || msg.role !== "typing",
        );
        return [
          ...messagesWithoutTyping,
          {
            role: "assistant",
            text: "대화 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
          },
        ];
      });
    });
  };

  const appendToLastMessage = (text: string) => {
    setMessages((prevMessages) => {
      if (prevMessages.length === 0) {
        return [{ role: "assistant", text }];
      }

      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
        text: lastMessage.text + text,
      };
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  const annotateLastMessage = (annotations: any[]) => {
    setMessages((prevMessages) => {
      const lastMessage = prevMessages[prevMessages.length - 1];
      const updatedLastMessage = {
        ...lastMessage,
      };
      annotations.forEach((annotation) => {
        if (annotation.type === "file_path") {
          updatedLastMessage.text = updatedLastMessage.text.replaceAll(
            annotation.text,
            `/api/files/${annotation.file_path.file_id}`,
          );
        }
      });
      return [...prevMessages.slice(0, -1), updatedLastMessage];
    });
  };

  // 로딩 상태 표시
  if (isLoading || templateLoading) {
    return (
      <div className="flex flex-col h-full w-full justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        <p className="text-lg mt-4">
          {templateLoading
            ? "인터뷰 템플릿을 불러오는 중입니다..."
            : "인터뷰를 준비하는 중입니다..."}
        </p>
      </div>
    );
  }

  // 템플릿이 없는 경우 에러 화면
  if (noTemplateError) {
    return (
      <div className="flex flex-col h-full w-full justify-center items-center p-6">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            인터뷰 템플릿이 설정되지 않았습니다
          </h2>
          <div className="text-gray-600 mb-6 space-y-2">
            <p>관리자가 아직 인터뷰 템플릿을 등록하지 않았습니다.</p>
            <p>인터뷰를 진행하려면 관리자에게 문의해주세요.</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">관리자 정보:</p>
              <p>
                관리자 코드:{" "}
                <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">
                  {adminId}
                </code>
              </p>
              {userIdentifier && (
                <p className="mt-1">사용자: {userIdentifier}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => window.history.back()}
            className="py-2 px-6 bg-black text-white rounded-full hover:bg-gray-800 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse h-full w-full relative">
      {/* 사용자 식별자 표시 */}
      {userIdentifier && (
        <div className="absolute top-0 left-4 text-xs text-gray-400">
          사용자: {userIdentifier}
        </div>
      )}

      {/* 인터뷰 상태 표시 */}
      <div className="absolute top-6 left-4 text-xs">
        {!interviewStarted ? (
          <span className="text-blue-500">인터뷰 시작 대기 중</span>
        ) : interviewCompleted ? (
          <span className="text-green-500">인터뷰 완료됨</span>
        ) : (
          <span className="text-orange-500">인터뷰 진행 중</span>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="flex-grow overflow-y-auto p-2.5 flex flex-col order-2 whitespace-pre-wrap pt-12">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`my-2 w-full flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <Message key={index} role={msg.role} text={msg.text} />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 하단 입력/버튼 영역 */}
      <div className="p-2.5 pb-10 order-1">
        {!interviewStarted ? (
          // 인터뷰 시작 전: 시작 버튼
          <div className="flex justify-center">
            <button
              onClick={handleStartInterview}
              disabled={startingInterview || !threadId}
              className="py-3 px-6 bg-blue-500 text-white text-lg rounded-xl disabled:bg-gray-300 hover:bg-blue-600 transition-colors"
            >
              {startingInterview ? "시작 중..." : "인터뷰 시작하기"}
            </button>
          </div>
        ) : interviewCompleted ? (
          // 인터뷰 완료 후: 완료 메시지
          <div className="text-center py-4">
            <p className="text-green-600 font-medium">
              인터뷰가 완료되었습니다. 감사합니다! 🎉
            </p>
          </div>
        ) : (
          // 인터뷰 진행 중: 입력폼 + 완료 버튼
          <div className="space-y-2">
            {/* 완료 버튼 */}
            <div className="flex justify-center">
              <button
                onClick={handleCompleteInterview}
                disabled={completingInterview}
                className="py-2 px-4 bg-red-500 text-white text-sm rounded-lg disabled:bg-gray-300 hover:bg-red-600 transition-colors"
              >
                {completingInterview ? "완료 중..." : "인터뷰 완료하기"}
              </button>
            </div>

            {/* 메시지 입력폼 */}
            <form onSubmit={handleSubmit} className="flex w-full">
              <input
                type="text"
                className="flex-grow py-3 px-4 mr-2.5 rounded-xl text-base bg-gray-100"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="답변을 입력해주세요..."
                disabled={inputDisabled}
              />
              <button
                type="submit"
                className="py-2 px-4 bg-black text-white border-none text-base rounded-xl disabled:bg-gray-300"
                disabled={inputDisabled || !userInput.trim()}
              >
                전송
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;

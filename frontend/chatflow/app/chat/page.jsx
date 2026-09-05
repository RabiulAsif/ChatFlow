"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

export default function ChatPage() {
    const router = useRouter();

    const socketRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Refs to avoid stale-closure reads inside the WebSocket handler
    const conversationIdRef = useRef(null);
    const selectedUserRef = useRef(null);

    const [currentUser, setCurrentUser] = useState(null);

    const [search, setSearch] = useState("");
    const [users, setUsers] = useState([]);

    const [selectedUser, setSelectedUser] = useState(null);
    const [conversationId, setConversationId] = useState(null);

    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");

    const [loading, setLoading] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);

    const [error, setError] = useState("");

    const [isOtherOnline, setIsOtherOnline] = useState(false);
    const [isTyping, setIsTyping] = useState(false);

    const [darkMode, setDarkMode] = useState(false);

    // ==================================================
    // DARK MODE
    // ==================================================

    useEffect(() => {
        const stored = localStorage.getItem("theme");

        const prefersDark =
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;

        const shouldUseDark = stored
            ? stored === "dark"
            : prefersDark;

        if (shouldUseDark) {
            document.documentElement.classList.add("dark");
            setDarkMode(true);
        }
    }, []);

    const toggleDarkMode = () => {
        const next = !darkMode;

        setDarkMode(next);

        if (next) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    };

    // ==================================================
    // GET TOKEN
    // ==================================================

    const getToken = () => {
        return localStorage.getItem("access_token");
    };

    // ==================================================
    // GET CURRENT USER
    // ==================================================

    const getCurrentUser = async () => {
        const token = getToken();

        if (!token) {
            router.push("/");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/me`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                localStorage.removeItem("access_token");
                router.push("/");
                return;
            }

            const data = await response.json();

            setCurrentUser(data);
        } catch (error) {
            console.error(error);
            setError("Could not connect to server.");
        }
    };

    // ==================================================
    // CONNECT WEBSOCKET
    // ==================================================

    const connectWebSocket = () => {
        const token = getToken();

        if (!token) {
            return;
        }

        // Close old socket
        if (socketRef.current) {
            socketRef.current.close();
        }

        const socket = new WebSocket(
            `${WS_URL}/ws?token=${encodeURIComponent(token)}`
        );

        socketRef.current = socket;

        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                console.log("WebSocket:", data);

                // ------------------------------------------
                // NEW MESSAGE
                // ------------------------------------------

                if (data.type === "message") {
                    setMessages((prev) => {
                        // Only show message for the currently open conversation
                        if (
                            data.conversation_id !==
                            conversationIdRef.current
                        ) {
                            return prev;
                        }

                        const exists = prev.some(
                            (message) => message.id === data.id
                        );

                        if (exists) {
                            return prev;
                        }

                        return [...prev, data];
                    });

                    return;
                }

                // ------------------------------------------
                // MESSAGE DELETED
                // ------------------------------------------

                if (data.type === "message_deleted") {
                    setMessages((prev) =>
                        prev.filter(
                            (message) =>
                                message.id !== data.message_id
                        )
                    );

                    return;
                }

                // ------------------------------------------
                // TYPING
                // ------------------------------------------

                if (data.type === "typing") {
                    if (
                        selectedUserRef.current &&
                        data.user_id === selectedUserRef.current.id &&
                        data.conversation_id === conversationIdRef.current
                    ) {
                        setIsTyping(data.is_typing);
                    }

                    return;
                }

                // ------------------------------------------
                // STATUS (online / offline)
                // ------------------------------------------

                if (data.type === "status") {
                    if (
                        selectedUserRef.current &&
                        data.user_id === selectedUserRef.current.id
                    ) {
                        setIsOtherOnline(data.status === "online");
                    }

                    return;
                }

            } catch (error) {
                console.error(
                    "WebSocket message error:",
                    error
                );
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected");
        };
    };

    // ==================================================
    // INITIAL LOAD
    // ==================================================

    useEffect(() => {
        getCurrentUser();
        connectWebSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
            }

            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    // ==================================================
    // AUTO SCROLL
    // ==================================================

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: "smooth",
        });
    }, [messages, isTyping]);

    // ==================================================
    // SEARCH USERS
    // ==================================================

    const searchUsers = async () => {
        if (!search.trim()) {
            setUsers([]);
            return;
        }

        const token = getToken();

        if (!token) {
            router.push("/");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `${API_URL}/users/search?username=${encodeURIComponent(
                    search.trim()
                )}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setError(data.detail || "Search failed.");
                setUsers([]);
                return;
            }

            setUsers(data);
        } catch (error) {
            console.error(error);
            setError("Could not connect to server.");
        } finally {
            setLoading(false);
        }
    };

    // ==================================================
    // START CONVERSATION
    // ==================================================

    const selectUser = async (user) => {
        const token = getToken();

        if (!token) {
            router.push("/");
            return;
        }

        setSelectedUser(user);
        selectedUserRef.current = user;

        setMessages([]);
        setConversationId(null);
        conversationIdRef.current = null;

        setIsTyping(false);
        setIsOtherOnline(false);
        setChatLoading(true);
        setError("");

        try {
            // Create or get existing conversation
            const response = await fetch(
                `${API_URL}/conversations`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        user_id: user.id,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                        "Could not create conversation."
                );
            }

            const newConversationId = data.conversation_id;

            setConversationId(newConversationId);
            conversationIdRef.current = newConversationId;

            // Load previous messages
            await loadMessages(newConversationId, token);

        } catch (error) {
            console.error(error);
            setError(error.message);
        } finally {
            setChatLoading(false);
        }
    };

    // ==================================================
    // LOAD MESSAGES
    // ==================================================

    const loadMessages = async (id, token) => {
        try {
            const response = await fetch(
                `${API_URL}/conversations/${id}/messages`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.detail ||
                        "Could not load messages."
                );
            }

            setMessages(data);
        } catch (error) {
            console.error(error);
            setError(error.message);
        }
    };

    // ==================================================
    // SEND MESSAGE
    // ==================================================

    const sendMessage = () => {
        const text = messageInput.trim();

        if (!text) {
            return;
        }

        if (!conversationId) {
            return;
        }

        if (!selectedUser) {
            return;
        }

        const socket = socketRef.current;

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            setError("WebSocket is not connected.");
            return;
        }

        socket.send(
            JSON.stringify({
                type: "message",
                receiver_id: selectedUser.id,
                conversation_id: conversationId,
                content: text,
            })
        );

        setMessageInput("");

        // Stop typing
        socket.send(
            JSON.stringify({
                type: "typing",
                conversation_id: conversationId,
                receiver_id: selectedUser.id,
                is_typing: false,
            })
        );
    };

    // ==================================================
    // ENTER TO SEND
    // ==================================================

    const handleMessageKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ==================================================
    // TYPING
    // ==================================================

    const handleTyping = (e) => {
        const value = e.target.value;

        setMessageInput(value);

        if (!selectedUser) {
            return;
        }

        const socket = socketRef.current;

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        socket.send(
            JSON.stringify({
                type: "typing",
                conversation_id: conversationId,
                receiver_id: selectedUser.id,
                is_typing: value.length > 0,
            })
        );

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            socket.send(
                JSON.stringify({
                    type: "typing",
                    conversation_id: conversationId,
                    receiver_id: selectedUser.id,
                    is_typing: false,
                })
            );
        }, 1500);
    };

    // ==================================================
    // DELETE MESSAGE
    // ==================================================

    const deleteMessage = (messageId) => {
        const socket = socketRef.current;

        if (
            !socket ||
            socket.readyState !== WebSocket.OPEN
        ) {
            setError("WebSocket is not connected.");
            return;
        }

        socket.send(
            JSON.stringify({
                type: "delete_message",
                message_id: messageId,
            })
        );
    };

    // ==================================================
    // LOGOUT
    // ==================================================

    const logout = () => {
        if (socketRef.current) {
            socketRef.current.close();
        }

        localStorage.removeItem("access_token");

        router.push("/");
    };

    // ==================================================
    // FORMAT TIME
    // ==================================================

    const formatTime = (dateString) => {
        if (!dateString) {
            return "";
        }

        const date = new Date(dateString);

        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // ==================================================
    // UI
    // ==================================================

    return (
        <main className="min-h-screen bg-gray-100 dark:bg-gray-950">

            {/* HEADER */}
            <header className="border-b bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">

                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-blue-600 sm:text-2xl dark:text-blue-400">
                            ChatFlow
                        </h1>

                        {currentUser && (
                            <p className="truncate text-xs text-gray-500 sm:text-sm dark:text-gray-400">
                                Welcome, {currentUser.username}
                            </p>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 sm:gap-3">

                        <button
                            onClick={toggleDarkMode}
                            aria-label="Toggle dark mode"
                            className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:px-3 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                            <span aria-hidden="true">
                                {darkMode ? "☀️" : "🌙"}
                            </span>
                            <span className="hidden sm:inline">
                                {darkMode ? " Light" : " Dark"}
                            </span>
                        </button>

                        <button
                            onClick={logout}
                            className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-600 sm:px-4"
                        >
                            Logout
                        </button>

                    </div>

                </div>
            </header>

            {/* MAIN */}
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 md:grid-cols-3">

                {/* ==========================================
                    LEFT SIDEBAR
                ========================================== */}

                <aside className="rounded-2xl bg-white p-5 shadow md:col-span-1 dark:bg-gray-900">

                    <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Find Users
                    </h2>

                    <div className="flex gap-2">

                        <input
                            type="text"
                            id="search"
                            name="search"
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    searchUsers();
                                }
                            }}
                            placeholder="Search username..."
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        />

                        <button
                            onClick={searchUsers}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            Search
                        </button>

                    </div>

                    {error && (
                        <p className="mt-3 text-sm text-red-500 dark:text-red-400">
                            {error}
                        </p>
                    )}

                    {loading && (
                        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                            Searching...
                        </p>
                    )}

                    {/* USER LIST */}
                    <div className="mt-5 space-y-2">

                        {users.map((user) => (

                            <button
                                key={user.id}
                                onClick={() =>
                                    selectUser(user)
                                }
                                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                                    selectedUser?.id === user.id
                                        ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950"
                                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                                }`}
                            >

                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                                    {user.username
                                        .charAt(0)
                                        .toUpperCase()}
                                </div>

                                <div className="min-w-0">

                                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                                        {user.username}
                                    </p>

                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                        {user.email}
                                    </p>

                                </div>

                            </button>

                        ))}

                        {!loading &&
                            search &&
                            users.length === 0 &&
                            !error && (
                                <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                                    No users found.
                                </p>
                            )}

                    </div>

                </aside>

                {/* ==========================================
                    CHAT AREA
                ========================================== */}

                <section className="flex min-h-[650px] flex-col overflow-hidden rounded-2xl bg-white shadow md:col-span-2 dark:bg-gray-900">

                    {/* CHAT HEADER */}

                    <div className="border-b px-5 py-4 dark:border-gray-800">

                        {selectedUser ? (

                            <div className="flex items-center gap-3">

                                <div className="relative">

                                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                                        {selectedUser.username
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>

                                    {isOtherOnline && (
                                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900"></span>
                                    )}

                                </div>

                                <div>

                                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                                        {selectedUser.username}
                                    </h2>

                                    <p className="text-xs text-gray-500 dark:text-gray-400">

                                        {isTyping
                                            ? "Typing..."
                                            : isOtherOnline
                                            ? "Online"
                                            : "Offline"}

                                    </p>

                                </div>

                            </div>

                        ) : (

                            <div>
                                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                                    Select a user
                                </h2>

                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Search for a user to start chatting.
                                </p>
                            </div>

                        )}

                    </div>

                    {/* ======================================
                        MESSAGES
                    ====================================== */}

                    <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-5 dark:bg-gray-950">

                        {!selectedUser && (
                            <div className="flex h-full items-center justify-center text-center">

                                <div>

                                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-3xl dark:bg-blue-950">
                                        💬
                                    </div>

                                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                                        Welcome to ChatFlow
                                    </h3>

                                    <p className="mt-2 text-gray-500 dark:text-gray-400">
                                        Search for another user and start a conversation.
                                    </p>

                                </div>

                            </div>
                        )}

                        {selectedUser && chatLoading && (
                            <div className="flex h-full items-center justify-center">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Loading conversation...
                                </p>
                            </div>
                        )}

                        {selectedUser &&
                            !chatLoading &&
                            messages.length === 0 && (
                                <div className="flex h-full items-center justify-center text-center">

                                    <div>

                                        <p className="text-gray-500 dark:text-gray-400">
                                            No messages yet.
                                        </p>

                                        <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
                                            Send the first message.
                                        </p>

                                    </div>

                                </div>
                            )}

                        {selectedUser &&
                            messages.map((message) => {

                                const isMine =
                                    message.sender_id ===
                                    currentUser?.id;

                                return (
                                    <div
                                        key={message.id}
                                        className={`flex ${
                                            isMine
                                                ? "justify-end"
                                                : "justify-start"
                                        }`}
                                    >

                                        <div
                                            className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                                                isMine
                                                    ? "rounded-br-md bg-blue-600 text-white"
                                                    : "rounded-bl-md bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
                                            }`}
                                        >

                                            <p className="whitespace-pre-wrap break-words text-sm">
                                                {message.content}
                                            </p>

                                            <div
                                                className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
                                                    isMine
                                                        ? "text-blue-100"
                                                        : "text-gray-400 dark:text-gray-500"
                                                }`}
                                            >

                                                <span>
                                                    {formatTime(
                                                        message.created_at
                                                    )}
                                                </span>

                                                {isMine && (
                                                    <button
                                                        onClick={() =>
                                                            deleteMessage(
                                                                message.id
                                                            )
                                                        }
                                                        className="font-medium text-red-200 transition hover:text-white"
                                                    >
                                                        Delete
                                                    </button>
                                                )}

                                            </div>

                                        </div>

                                    </div>
                                );
                            })}

                        {isTyping && selectedUser && (
                            <div className="flex justify-start">

                                <div className="rounded-2xl rounded-bl-md bg-white px-4 py-2 text-sm text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-400">
                                    {selectedUser.username} is typing...
                                </div>

                            </div>
                        )}

                        <div ref={messagesEndRef} />

                    </div>

                    {/* ======================================
                        MESSAGE INPUT
                    ====================================== */}

                    {selectedUser && (

                        <div className="border-t bg-white p-4 dark:border-gray-800 dark:bg-gray-900">

                            <div className="flex items-end gap-3">

                                <textarea
                                    id="message"
                                    name="message"
                                    value={messageInput}
                                    onChange={handleTyping}
                                    onKeyDown={handleMessageKeyDown}
                                    placeholder="Type a message..."
                                    rows={1}
                                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                                />

                                <button
                                    onClick={sendMessage}
                                    disabled={!messageInput.trim()}
                                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Send
                                </button>

                            </div>

                            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                                Press Enter to send
                            </p>

                        </div>

                    )}

                </section>

            </div>

            {/* FOOTER */}
            <footer className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                Built By{" "}
                <a
                    href="https://www.linkedin.com/in/md-rabiul-islam-asif-a0246a339/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                    Md. Rabiul Islam Asif
                </a>
            </footer>

        </main>
    );
}
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [status, setStatus] = useState("verifying");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Verification token is missing.");
            return;
        }

        const verifyEmail = async () => {
            try {
                const response = await fetch(
                    `${API_URL}/verify-email?token=${encodeURIComponent(token)}`
                );

                const data = await response.json();

                if (response.ok) {
                    setStatus("success");
                    setMessage(data.message);
                } else {
                    setStatus("error");
                    setMessage(
                        data.detail || "Email verification failed."
                    );
                }
            } catch (error) {
                setStatus("error");
                setMessage(
                    "Could not connect to the server. Please try again."
                );
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">

                {status === "verifying" && (
                    <>
                        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>

                        <h1 className="text-2xl font-bold text-gray-900">
                            Verifying your email
                        </h1>

                        <p className="mt-3 text-gray-600">
                            Please wait while we verify your email address...
                        </p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                            ✓
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900">
                            Email Verified!
                        </h1>

                        <p className="mt-3 text-gray-600">
                            {message}
                        </p>

                        <a
                            href="/"
                            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
                        >
                            Go to Login
                        </a>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
                            ✕
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900">
                            Verification Failed
                        </h1>

                        <p className="mt-3 text-red-600">
                            {message}
                        </p>

                        <a
                            href="/"
                            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
                        >
                            Back to Login
                        </a>
                    </>
                )}

            </div>
        </main>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
                        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Loading...
                        </h1>
                    </div>
                </main>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
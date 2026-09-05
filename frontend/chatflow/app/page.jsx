"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  function validateForm() {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (!isLogin) {
      if (cleanUsername.length < 3) {
        return "Username must be at least 3 characters.";
      }

      if (cleanUsername.length > 50) {
        return "Username cannot exceed 50 characters.";
      }

      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return "Username can only contain letters, numbers and underscore.";
      }
    }

    if (!cleanEmail) {
      return "Email is required.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return "Please enter a valid email address.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    if (!isLogin && password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setMessage(validationError);
      return;
    }

    setLoading(true);

    try {
      // -------------------------
      // REGISTER
      // -------------------------
      if (!isLogin) {
        const response = await fetch(`${API_URL}/register`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            email: email.trim(),
            password: password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Registration failed."
          );
        }

        // Registration successful
        setRegistrationSuccess(true);
        setMessage("");

        setUsername("");
        setPassword("");
        setConfirmPassword("");

        return;
      }

      // -------------------------
      // LOGIN
      // -------------------------
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Login failed."
        );
      }

      // Save JWT
      localStorage.setItem(
        "access_token",
        data.access_token
      );

      setMessage("Login successful!");

      setPassword("");

      console.log("JWT saved successfully.");

      // Go to Chat Dashboard
router.push("/chat");

    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function switchMode(loginMode) {
    setIsLogin(loginMode);

    setMessage("");
    setRegistrationSuccess(false);

    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
  }

  // --------------------------------
  // CHECK YOUR EMAIL SCREEN
  // --------------------------------
  if (registrationSuccess) {
    return (
      <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">

        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center">

          <div className="text-5xl mb-5">
            📧
          </div>

          <h1 className="text-2xl font-bold text-gray-900">
            Check your email
          </h1>

          <p className="text-gray-600 mt-3 leading-relaxed">
            We&apos;ve sent a verification link to your email
            address.
          </p>

          <p className="text-gray-500 text-sm mt-2">
            Please open the email and click the
            <span className="font-semibold">
              {" "}Verify Email{" "}
            </span>
            button to activate your account.
          </p>

          <button
            type="button"
            onClick={() => switchMode(true)}
            className="w-full mt-7 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Go to Login
          </button>

        </div>

      </main>
    );
  }

  // --------------------------------
  // LOGIN / REGISTER SCREEN
  // --------------------------------
  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center px-4">

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">

        {/* Logo / Title */}
        <div className="text-center">

          <h1 className="text-3xl font-bold text-gray-900">
            ChatFlow
          </h1>

          <p className="text-gray-500 mt-2">
            Real-time communication made simple
          </p>

        </div>

        {/* Login / Register Toggle */}
        <div className="flex mt-8 bg-gray-100 rounded-lg p-1">

          <button
            type="button"
            onClick={() => switchMode(true)}
            className={`w-1/2 py-2 rounded-md font-medium transition ${
              isLogin
                ? "bg-white shadow text-gray-900"
                : "text-gray-500"
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => switchMode(false)}
            className={`w-1/2 py-2 rounded-md font-medium transition ${
              !isLogin
                ? "bg-white shadow text-gray-900"
                : "text-gray-500"
            }`}
          >
            Register
          </button>

        </div>

        {/* Message */}
        {message && (
          <div className="mt-5 p-3 bg-gray-100 rounded-lg text-center text-sm text-gray-700">
            {message}
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4"
        >

          {/* Username */}
          {!isLogin && (
            <div>

              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Username
              </label>

              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="username"
                required
              />

            </div>
          )}

          {/* Email */}
          <div>

            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="email"
              required
            />

          </div>

          {/* Password */}
          <div>

            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
              required
            />

          </div>

          {/* Confirm Password */}
          {!isLogin && (
            <div>

              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirm Password
              </label>

              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="new-password"
                required
              />

            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-blue-400"
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login"
                : "Create Account"}
          </button>

        </form>

      </div>

    </main>
  );
}
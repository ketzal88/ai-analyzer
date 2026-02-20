"use client";

import React, { useState } from "react";
import AuthLayout from "@/components/layouts/AuthLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { signInWithGoogle } = useAuth();

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError(null);
            await signInWithGoogle();

            // Get ID token and set session cookie
            const user = await import("firebase/auth").then((mod) => mod.getAuth().currentUser);
            if (user) {
                const idToken = await user.getIdToken();
                await fetch("/api/auth/session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idToken }),
                });
            }
        } catch (err: any) {
            console.error("Google sign-in error:", err);
            setError(err.message || "Failed to sign in with Google");
        } finally {
            setLoading(false);
        }
    };

    const handleEmailContinue = () => {
        // Email/password sign-in can be implemented here if needed
        console.log("Continue with email:", email);
        setError("Email/password sign-in not yet implemented. Please use Google sign-in.");
    };

    return (
        <AuthLayout>
            <div className="w-full max-w-md">
                <div className="card">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <img src="/img/logo-v-worker-brain.png" alt="Worker Brain" className="h-24 w-auto" />
                    </div>

                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-hero text-text-primary mb-2">Sign In</h1>
                        <p className="text-body text-text-secondary">
                            Access your Meta Ads diagnostic suite.
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20" style={{ borderRadius: 0 }}>
                            <p className="text-body text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Google Sign In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className="w-full bg-argent/20 text-text-primary px-6 py-3 border border-argent hover:border-classic transition-all duration-200 flex items-center justify-center gap-3 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderRadius: 0, letterSpacing: '1px' }}
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path
                                fill="#4285F4"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="#34A853"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                                fill="#EA4335"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        {loading ? "Signing in..." : "Sign in with Google"}
                    </button>

                    {/* Divider */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-argent"></div>
                        </div>
                        <div className="relative flex justify-center text-small">
                            <span className="bg-second px-3 text-text-muted">OR SIGN IN WITH EMAIL</span>
                        </div>
                    </div>

                    {/* Email Input */}
                    <div className="mb-6">
                        <label htmlFor="email" className="block text-body text-text-secondary mb-2">
                            Work Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full"
                        />
                    </div>

                    {/* Continue Button */}
                    <button
                        onClick={handleEmailContinue}
                        className="btn-primary w-full mb-4"
                    >
                        Continue with Email
                    </button>

                    {/* Forgot Password Link */}
                    <div className="text-center">
                        <a
                            href="#"
                            className="text-body text-classic hover:underline"
                        >
                            Forgot your password?
                        </a>
                    </div>
                </div>
            </div>
        </AuthLayout>
    );
}

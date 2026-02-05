"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    signInWithPopup,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: FirebaseUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Listen for auth state changes
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            // Add additional scopes if needed
            provider.addScope("profile");
            provider.addScope("email");

            const result = await signInWithPopup(auth, provider);

            // User is signed in, redirect to account selector
            if (result.user) {
                router.push("/select-account");
            }
        } catch (error: any) {
            console.error("Error signing in with Google:", error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            router.push("/");
        } catch (error: any) {
            console.error("Error signing out:", error);
            throw error;
        }
    };

    const value = {
        user,
        loading,
        signInWithGoogle,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

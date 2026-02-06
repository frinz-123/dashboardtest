"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

export default function SignIn() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <div className="mt-8 space-y-6">
          <div>
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 border-gray-300"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <Image
                  src="/google.svg"
                  alt="Google Logo"
                  width={20}
                  height={20}
                  className="h-5 w-5"
                />
              </span>
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

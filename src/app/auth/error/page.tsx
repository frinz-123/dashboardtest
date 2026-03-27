"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams ? searchParams.get("error") : null;
  const errorMessage =
    error === "AccessDenied"
      ? "No tienes permiso para acceder a esta aplicación."
      : error === "UntrustedHost"
        ? "El servidor de autenticacion no confia en el host actual. Revisa AUTH_TRUST_HOST y AUTH_URL o NEXTAUTH_URL en Netlify."
      : error === "Configuration"
        ? "La autenticacion no esta configurada correctamente en produccion. Revisa las variables de entorno de Google OAuth y AUTH_SECRET en Netlify."
        : error === "OAuthSignin"
          ? "No se pudo iniciar la autenticacion con Google. Revisa la configuracion del proveedor y el dominio de produccion."
          : "Ocurrio un error durante la autenticacion.";

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Error de Autenticación
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {errorMessage}
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

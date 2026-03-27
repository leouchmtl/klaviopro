"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function GmailSettings() {
  const { data: session, status } = useSession();
  const params = useSearchParams();

  const connected =
    status === "authenticated" &&
    Boolean(session?.accessToken) &&
    session?.error !== "RefreshAccessTokenError";

  const errorParam = params.get("error");

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900">Gmail</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Connectez votre compte Gmail pour voir et envoyer des emails directement depuis KlavioPro.
        </p>
      </div>

      {/* Error from OAuth flow */}
      {errorParam && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-800">
          Échec de la connexion Gmail ({errorParam}). Veuillez réessayer.
        </div>
      )}

      {/* Token refresh error */}
      {session?.error === "RefreshAccessTokenError" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
          La session Gmail a expiré. Veuillez vous reconnecter.
        </div>
      )}

      {/* Status */}
      {status === "loading" ? (
        <div className="text-sm text-slate-400">Vérification…</div>
      ) : connected ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">Connecté</p>
              {session?.user?.email && (
                <p className="text-xs text-slate-500">{session.user.email}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/settings" })}
            className="text-sm text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            Déconnecter
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
            <p className="text-sm text-slate-500">Non connecté</p>
          </div>
          <button
            onClick={() => signIn("google", { callbackUrl: "/settings" })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <GmailIcon />
            Connecter Gmail
          </button>
        </div>
      )}

      {/* Permissions note */}
      <div className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        Permissions requises : lecture (gmail.readonly) + envoi (gmail.send).
        Vos données restent sur votre compte Google.
      </div>
    </div>
  );
}

function GmailIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Save } from "lucide-react";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: session, update } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        setMessage(t("profileUpdated"));
        await update();
      } else {
        const data = await res.json();
        setMessage(data.error || t("failedToUpdate"));
      }
    } catch {
      setMessage(t("errorSaving"));
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-900 dark:bg-gray-900 dark:text-white">
          {message}
        </div>
      )}

      {/* Profile */}
      <form onSubmit={handleSaveProfile} className="rounded-xl border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {t("profile")}
        </h2>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            type="email"
            value={session?.user?.email || ""}
            disabled
            className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("name")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-white dark:focus:ring-white/20"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 text-sm font-medium dark:bg-white dark:text-black dark:hover:bg-gray-200 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {t("updateProfile")}
        </button>
      </form>
    </div>
  );
}

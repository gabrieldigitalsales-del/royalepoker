import React, { useState } from "react";

export function PrivateNote({
  storageKey,
  title,
}: {
  storageKey: string;
  title: string;
}) {
  const [note, setNote] = useState(
    () => localStorage.getItem(storageKey) ?? "",
  );
  return (
    <label className="private-note">
      <span>{title}</span>
      <textarea
        value={note}
        maxLength={400}
        onChange={(event) => {
          const value = event.target.value;
          setNote(value);
          if (value) localStorage.setItem(storageKey, value);
          else localStorage.removeItem(storageKey);
        }}
      />
    </label>
  );
}

export function downloadText(filename: string, text: string) {
  const objectUrl = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

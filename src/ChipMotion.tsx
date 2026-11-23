import React from "react";
import { num } from "./api";
import "./chip-motion.css";

export function ChipAmount({
  amount,
  label,
}: {
  amount: number;
  label: string;
}) {
  return (
    <div className="chip-amount">
      <span className="chip-amount-icon" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <small>{label}</small>
        <strong key={amount}>{num(amount)}</strong>
      </span>
    </div>
  );
}

export function ChipReceipt({
  amount,
  label,
}: {
  amount: number;
  label: string;
}) {
  if (!amount) return null;
  return (
    <div className="chip-receipt" role="status">
      <span className="chip-receipt-burst" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <i
            key={index}
            style={{ "--ray": index * 45 + "deg" } as React.CSSProperties}
          />
        ))}
      </span>
      <strong>{label}</strong>
      <span>{num(amount)} fichas</span>
    </div>
  );
}

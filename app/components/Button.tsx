"use client";

import classNames from "classnames";
import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";

interface ButtonProps {
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  preset?: "black" | "white";
  icon?: string; // 아이콘 추가
  error?: string; // 에러 메시지
}

export const Button = ({
  type = "button",
  onClick,
  disabled = false,
  children,
  preset = "black",
  icon, // 아이콘 추가
  error,
}: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "w-full py-3 rounded-xl font-medium gap-4 flex items-center relative",
        "transition-all duration-200 ease-in-out",
        preset === "black"
          ? "bg-black text-white disabled:bg-black/10"
          : "bg-white text-black disabled:bg-black/10",
        disabled
          ? "cursor-not-allowed "
          : "cursor-pointer hover:opacity-80 active:scale-95",
        icon ? "justify-between pl-4 pr-3" : "justify-center px-4",
      )}
    >
      {children}
      {icon && <Icon icon={icon} size={20} />}
    </button>
  );
};

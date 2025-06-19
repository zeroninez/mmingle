"use client";

import classNames from "classnames";
import React, { useState, useEffect } from "react";
import { Icon } from "./Icon";

interface FABProps {
  onClick?: () => void;
  children?: React.ReactNode;
  icon?: string; // 아이콘 추가
  text?: string; // 텍스트 표시 여부
  size?: "small" | "medium" | "large"; // 크기 조절
}

export const FAB = ({ onClick, icon, text, size = "medium" }: FABProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "w-fit h-fit px-3 py-1.5 rounded-xl bg-module-bg flex justify-center items-center relative",
        "hover:bg-module-hover active:scale-95",
        "transition-all duration-200 ease-in-out",
      )}
    >
      {icon && (
        <Icon
          icon={icon}
          size={size === "small" ? 16 : size === "medium" ? 20 : 24}
        />
      )}
      {text && (
        <span
          className={classNames(
            "font-medium",
            size === "small"
              ? "text-xs"
              : size === "medium"
                ? "text-base"
                : "text-lg",
          )}
        >
          {text}
        </span>
      )}
    </button>
  );
};

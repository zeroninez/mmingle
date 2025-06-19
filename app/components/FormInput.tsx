import React from "react";
import classNames from "classnames";

interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  type?: "text" | "email" | "password" | "number";
  className?: string;

  // 우측 버튼 관련
  rightButton?: {
    text: string;
    onClick: () => void;
    show?: boolean;
    title?: string;
    className?: string;
  };

  // 액션 버튼
  actionButton?: {
    text: string;
    onClick: () => void;
    className?: string;
  };

  // 하단 메시지 관련
  message?: {
    text: string;
    type: "success" | "error" | "info" | "warning";
    show?: boolean;
  };
}

const messageStyles = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-black/50",
  warning: "text-yellow-500",
};

const messageIcons = {
  success: "●",
  error: "●",
  info: "",
  warning: "●",
};

export const FormInput: React.FC<FormInputProps> = ({
  label,
  value,
  onChange,
  onKeyPress,
  placeholder,
  disabled = false,
  required = false,
  type = "text",
  className,
  rightButton,
  actionButton,
  message,
}) => {
  return (
    <div
      className={classNames("w-full h-fit flex flex-col gap-2.5", className)}
    >
      {/* 라벨 */}
      <label className="text-sm font-semibold flex flex-row justify-start items-start">
        {label} {required && <span className="text-[6px] mt-[3px]">●</span>}
      </label>

      {/* 입력 필드 */}
      <div className="relative flex flex-row gap-2 w-full justify-between items-center">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl placeholder:opacity-50"
          disabled={disabled}
        />

        {/* 액션 버튼 */}
        {actionButton && (
          <button
            type="button"
            onClick={actionButton.onClick}
            className={classNames(
              "bg-button-gray px-3.5 py-2 w-fit h-fit whitespace-pre flex flex-row gap-1 rounded-xl transition-all",
              "hover:bg-button-grayHover",
              "active:scale-95",
              actionButton.className,
            )}
          >
            {actionButton.text}
          </button>
        )}

        {/* 우측 버튼 */}
        {rightButton && rightButton.show !== false && value.trim() && (
          <button
            type="button"
            onClick={rightButton.onClick}
            className={classNames(
              "absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-black text-white px-2 py-1 rounded-lg hover:border hover:border-black hover:bg-white hover:text-black transition-colors",
              rightButton.className,
            )}
            title={rightButton.title}
          >
            {rightButton.text}
          </button>
        )}
      </div>

      {/* 하단 메시지 */}
      {message && message.show !== false && (
        <div
          className={classNames(
            "w-full h-fit px-1 text-xs ",
            messageStyles[message.type],
          )}
        >
          {messageIcons[message.type]} {message.text}
        </div>
      )}
    </div>
  );
};

"use client";
import classNames from "classnames";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingProps {
  className?: string;
  text: string[];
  speed?: number; // 타이핑 속도 (ms)
  delay?: number; // 라인 간 딜레이 (ms)
}

export const Typing = (props: TypingProps) => {
  const { text, className, speed = 50, delay = 300 } = props;
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState<string[]>([]);

  useEffect(() => {
    if (currentLineIndex >= text.length) return;

    const currentLine = text[currentLineIndex];

    if (currentCharIndex < currentLine.length) {
      // 현재 라인 타이핑 중
      const timer = setTimeout(() => {
        setDisplayedText((prev) => {
          const newText = [...prev];
          newText[currentLineIndex] = currentLine.slice(
            0,
            currentCharIndex + 1,
          );
          return newText;
        });
        setCurrentCharIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    } else {
      // 현재 라인 완료, 다음 라인으로
      const timer = setTimeout(() => {
        setCurrentLineIndex((prev) => prev + 1);
        setCurrentCharIndex(0);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, currentCharIndex, text, speed, delay]);

  return (
    <div className={classNames(className, "w-full")}>
      {text.map((line, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{
            opacity: index <= currentLineIndex ? (index === 0 ? 0.5 : 1) : 0,
            y: index <= currentLineIndex ? 0 : 20,
          }}
          transition={{
            duration: 2,
            type: "spring",
            stiffness: 20,
            damping: 10,
          }}
          style={{
            whiteSpace: "pre-line",
            opacity: index === 0 ? 0.5 : 1,
          }}
        >
          {index < currentLineIndex
            ? // 완료된 라인
              line
            : index === currentLineIndex
              ? // 현재 타이핑 중인 라인
                displayedText[index] || ""
              : null}
        </motion.div>
      ))}
    </div>
  );
};

"use client";

import classNames from "classnames";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "./Icon";

interface ModuleProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
  foldable?: boolean;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
};

export const Module = ({
  title,
  className,
  children,
  foldable = false,
}: ModuleProps) => {
  const sectionRef = useRef(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <motion.div
      ref={sectionRef}
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      exit="hidden"
      animate="visible"
      transition={{ duration: 0.8, ease: "easeInOut" }}
      layout // 레이아웃 변화를 부드럽게
      className={classNames(
        "w-full bg-module-bg rounded-xl overflow-hidden", // overflow-hidden 추가
        className,
      )}
    >
      <div className="w-full h-fit p-4 flex flex-col">
        {title && (
          <div
            className={classNames(
              "w-full h-fit flex flex-row justify-between gap-4 items-center",
              foldable
                ? "cursor-pointer active:opacity-80 hover:opacity-80 transition-all"
                : "cursor-default",
            )}
            onClick={() => foldable && setIsOpen((prev) => !prev)}
          >
            <h2 className="text-xl font-bold w-full h-fit text-left">
              {title}
            </h2>
            {foldable && (
              <button className="w-fit h-fit flex flex-col hover:opacity-80 transition-all">
                <motion.div
                  animate={{ rotate: isOpen ? 0 : 180 }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon icon="up" size={20} />
                </motion.div>
              </button>
            )}
          </div>
        )}

        <motion.div
          initial={false}
          animate={{
            height: !foldable || isOpen ? "auto" : 0,
            opacity: !foldable || isOpen ? 1 : 0,
          }}
          transition={{
            duration: 0.3,
            ease: "easeInOut",
            height: { duration: 0.3 },
            opacity: { duration: 0.2 },
          }}
          style={{ overflow: "hidden" }}
          className="w-full "
        >
          <div
            className={classNames(
              "w-full h-fit flex flex-col gap-5",
              title ? "pt-[30px]" : "pt-0",
            )}
          >
            {children}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface BreadcrumbItem {
  label: string;
  href: string;
  active?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  conversationId?: string;
  threadId?: string;
}

export const Breadcrumbs = ({
  items,
  conversationId,
  threadId,
}: BreadcrumbsProps) => {
  const pathname = usePathname();

  // 현재 경로에 따라 동적으로 항목 활성화
  const processedItems = items.map((item) => ({
    ...item,
    active: item.active !== undefined ? item.active : pathname === item.href,
  }));

  return (
    <nav className="mb-2 px-1 flex items-center text-sm">
      {processedItems.map((item, index) => (
        <React.Fragment key={item.href}>
          {index > 0 && <span className="mx-2 text-gray-400">/</span>}

          {item.active ? (
            <span className="text-gray-700 font-medium">{item.label}</span>
          ) : (
            <Link href={item.href} className="text-gray-500 hover:text-black">
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}

      {/* 대화 ID 또는 스레드 ID가 있으면 표시 */}
      {(conversationId || threadId) && (
        <>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-400 text-xs">
            {conversationId
              ? `Conversation #${conversationId.substring(0, 8)}`
              : threadId
                ? `Thread #${threadId.substring(0, 8)}`
                : ""}
          </span>
        </>
      )}
    </nav>
  );
};

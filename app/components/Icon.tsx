import React from "react";
import classNames from "classnames";
import { createElement } from "react";
import dropDown from "@/svgs/icons/dropDown.svg";
import dropUp from "@/svgs/icons/dropUp.svg";
import close from "@/svgs/icons/close.svg";
import left from "@/svgs/icons/left.svg";
import right from "@/svgs/icons/right.svg";
import arrowLeft from "@/svgs/icons/arrowLeft.svg";
import arrowRight from "@/svgs/icons/arrowRight.svg";
import check from "@/svgs/icons/check.svg";
import youtube from "@/svgs/icons/youtube.svg";
import instagram from "@/svgs/icons/instagram.svg";
import x from "@/svgs/icons/x.svg";
import up from "@/svgs/icons/up.svg";
import down from "@/svgs/icons/down.svg";
import menu from "@/svgs/icons/menu.svg";
import link from "@/svgs/icons/link.svg";
import plus from "@/svgs/icons/plus.svg";
import minus from "@/svgs/icons/minus.svg";
import arrowUp from "@/svgs/icons/arrowUp.svg";
import thegage from "@/svgs/icons/thegage.svg";
import blog from "@/svgs/icons/blog.svg";
import outlink from "@/svgs/icons/outlink.svg";
import copy from "@/svgs/icons/copy.svg";
import deleteIcon from "@/svgs/icons/delete.svg";
import edit from "@/svgs/icons/edit.svg";
import preview from "@/svgs/icons/preview.svg";

export const icons = {
  arrowUp,
  dropDown,
  dropUp,
  close,
  left,
  right,
  arrowLeft,
  arrowRight,
  check,
  instagram,
  youtube,
  x,
  up,
  down,
  menu,
  link,
  plus,
  minus,
  thegage,
  blog,
  outlink,
  copy,
  delete: deleteIcon,
  edit,
  preview,
};

interface IconProps {
  icon: string;
  color?: string;
  size?: number;
  className?: string;
  cotainerStyle?: React.CSSProperties;
  motion?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  inline?: boolean;
}

export const Icon = ({
  icon,
  color,
  size = 24,
  className,
  cotainerStyle,
  onClick,
  motion = true,
  inline = true,
  ...rest
}: IconProps) => {
  const baseIconClasses = " flex items-center justify-center cursor-pointer ";
  const baseInlineIconClasses =
    "inline-flex items-center justify-center cursor-pointer";

  if (!icons[icon]) return null;

  const Element = inline ? "span" : "div";

  return (
    <Element
      aria-label={icon}
      style={{
        ...cotainerStyle,
      }}
      className={classNames(
        inline ? baseInlineIconClasses : baseIconClasses,
        motion
          ? "transition-all duration-200 ease-in-out focus:opacity-50 active:opacity-50 active:scale-90"
          : "",
      )}
      onClick={onClick}
      {...rest}
    >
      {createElement(icons[icon], {
        style: {
          width: size.toString(),
        },
        className: className,
      })}
    </Element>
  );
};

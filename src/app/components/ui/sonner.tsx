"use client";

import { useTheme } from "../../context/ThemeContext";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  // choose green shade depending on current theme
  const successBg = theme === 'dark' ? '#15803d' : '#22c55e';
  const successText = theme === 'dark' ? '#d1fae5' : '#065f46';

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": successBg,
          "--success-text": successText,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

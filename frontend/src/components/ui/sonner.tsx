"use client"

import { useTheme } from "@/lib/theme"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: <Spinner size="sm" label="Loading" />,
        close: <CircleXIcon className="size-4" />,
      }}
      closeButton
      style={
        {
          "--normal-bg": "#000000",
          "--normal-text": "#ffffff",
          "--normal-border": "#000000",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
